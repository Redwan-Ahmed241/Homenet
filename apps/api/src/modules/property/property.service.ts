import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ICacheService } from '../../common/cache/cache.service.interface.js';
import { CACHE_TTL } from '../../common/cache/cache.service.interface.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { PROPERTY_ERRORS } from '../../common/errors/error-codes.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertyQueryDto } from './dto/property-query.dto.js';
import { CreatePropertyMediaDto } from './dto/create-property-media.dto.js';
import type { IPropertyRepository } from './interfaces/property-repository.interface.js';
import { UPLOAD_FOLDERS, ALLOWED_MIMETYPES, UPLOAD_LIMITS_MB } from '../../common/upload/upload.constants.js';
import type { IUploadService } from '../../common/upload/interfaces/upload.service.interface.js';

@Injectable()
export class PropertyService {
  constructor(
    @Inject('IPropertyRepository') private readonly propertyRepo: IPropertyRepository,
    private readonly logger: LoggerService,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    @Inject('IUploadService') private readonly uploadService: IUploadService,
    private readonly configService: ConfigService,
  ) {}

  private generateCacheKey(prefix: string, data: any): string {
    return this.cacheService.generateKey(prefix, data);
  }

  private async invalidateListCache() {
    await this.cacheService.del('properties:list:all');
  }

  private async invalidateDetailCache(id: string) {
    await this.cacheService.delMany([`properties:detail:${id}`, `properties:media:${id}`]);
  }

  private async invalidateAll(id: string) {
    await this.invalidateListCache();
    await this.invalidateDetailCache(id);
  }

  private validateAmenities(type: string, amenities: Record<string, any>): boolean {
    switch (type) {
      case 'residential':
      case 'commercial':
      case 'land':
      case 'parking':
        return true;
      default:
        return false;
    }
  }

  async findAll(query: PropertyQueryDto) {
    const cacheKey = this.generateCacheKey('properties:list', query);

    return this.cacheService.getOrSet(cacheKey, async () => {
      const {
        lat, lng, radius,
        ...rest
      } = query;

      const queryParams = {
        ...rest,
        page: rest.page ?? 1,
        limit: rest.limit ?? 20,
        sort_by: rest.sort_by ?? 'created_at_desc',
        lat,
        lng,
        radius,
      };

      if (lat !== undefined && lng !== undefined && radius !== undefined) {
        return this.propertyRepo.findWithProximitySearch(queryParams);
      }

      return this.propertyRepo.findPublished(queryParams);
    }, CACHE_TTL.LIST);
  }

  async findOne(id: string) {
    const cacheKey = `properties:detail:${id}`;

    return this.cacheService.getOrSet(cacheKey, async () => {
      const property = await this.propertyRepo.findPublishedById(id);

      if (!property || property.status !== 'active') {
        this.logger.warn(`Property not found: ${id}`, {
          fileName: 'property.service.ts',
          functionName: 'findOne',
          lineNumber: 98,
        });
        throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
      }

      await this.propertyRepo.incrementViewCount(id);
      property.view_count += 1;

      return property;
    }, CACHE_TTL.DETAIL);
  }

  /**
   * Required fields that must ALL be present for a property to go directly
   * to "pending" (admin review). If any is missing the property is saved
   * as "draft" so the user can complete it later.
   *
   * Note: `area_id` is always required by the DB and DTO — it is not
   * listed here because its presence is guaranteed.
   */
  private readonly REQUIRED_FIELDS: readonly string[] = [
    'title', 'type', 'listing_type', 'price',
  ];

  private computeInitialStatus(dto: CreatePropertyDto): 'draft' | 'pending' {
    const allPresent = this.REQUIRED_FIELDS.every((field) => {
      const val = (dto as unknown as Record<string, unknown>)[field];
      return val !== undefined && val !== null && val !== '';
    });
    return allPresent ? 'pending' : 'draft';
  }

  async create(dto: CreatePropertyDto, userId: string) {
    // Validate area exists
    const area = await this.propertyRepo.findAreaById(dto.area_id);
    if (!area) {
      this.logger.warn(`Area not found: ${dto.area_id}`, {
        fileName: 'property.service.ts',
        functionName: 'create',
        lineNumber: 130,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    // Validate amenities only when both type and amenities are provided
    if (dto.type && dto.amenities && Object.keys(dto.amenities).length > 0) {
      const valid = this.validateAmenities(dto.type, dto.amenities);
      if (!valid) {
        this.logger.warn(`Invalid amenities structure for property type ${dto.type}`, {
          fileName: 'property.service.ts',
          functionName: 'create',
          lineNumber: 142,
        });
        throw new AppException(PROPERTY_ERRORS.PROPERTY_INVALID_AMENITIES);
      }
    }

    const status = this.computeInitialStatus(dto);

    const property = await this.propertyRepo.create({
      user_id: userId,
      area_id: dto.area_id,
      title: dto.title ?? '',
      description: dto.description,
      type: dto.type ?? 'residential',
      subtype: dto.subtype,
      listing_type: dto.listing_type ?? 'sale',
      price: dto.price ?? 0,
      price_currency: dto.price_currency,
      area_size: dto.area_size,
      area_unit: dto.area_unit,
      location_lat: dto.location_lat,
      location_lng: dto.location_lng,
      address: dto.address,
      amenities: dto.amenities,
      virtual_tour_url: dto.virtual_tour_url,
      status,
    });

    await this.invalidateListCache();
    return property;
  }

  async update(id: string, dto: UpdatePropertyDto, userId: string, isAdmin: boolean) {
    const property = await this.propertyRepo.findById(id);

    if (!property) {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'update',
        lineNumber: 161,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to update property ${id} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'update',
        lineNumber: 168,
      });
      throw new ForbiddenException('You do not have permission to update this property');
    }

    if (dto.area_id) {
      const area = await this.propertyRepo.findAreaById(dto.area_id);
      if (!area) {
        throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
      }
    }

    if (dto.amenities && Object.keys(dto.amenities).length > 0) {
      const type = dto.type ?? property.type;
      const valid = this.validateAmenities(type, dto.amenities);
      if (!valid) {
        this.logger.warn(`Invalid amenities structure for property type ${type}`, {
          fileName: 'property.service.ts',
          functionName: 'update',
          lineNumber: 188,
        });
        throw new AppException(PROPERTY_ERRORS.PROPERTY_INVALID_AMENITIES);
      }
    }

    const updateData: Record<string, any> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.subtype !== undefined) updateData.subtype = dto.subtype;
    if (dto.listing_type !== undefined) updateData.listing_type = dto.listing_type;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.price_currency !== undefined) updateData.price_currency = dto.price_currency;
    if (dto.area_size !== undefined) updateData.area_size = dto.area_size;
    if (dto.area_unit !== undefined) updateData.area_unit = dto.area_unit;
    if (dto.location_lat !== undefined) updateData.location_lat = dto.location_lat;
    if (dto.location_lng !== undefined) updateData.location_lng = dto.location_lng;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.amenities !== undefined) updateData.amenities = dto.amenities;
    if (dto.virtual_tour_url !== undefined) updateData.virtual_tour_url = dto.virtual_tour_url;
    if (dto.area_id !== undefined) updateData.area = { connect: { id: dto.area_id } };
    if (dto.status !== undefined && isAdmin) updateData.status = dto.status;

    const updated = await this.propertyRepo.update(id, updateData);

    await this.invalidateAll(id);
    return updated;
  }

  async remove(id: string, userId: string, isAdmin: boolean) {
    const property = await this.propertyRepo.findById(id);

    if (!property) {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'remove',
        lineNumber: 228,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to delete property ${id} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'remove',
        lineNumber: 235,
      });
      throw new ForbiddenException('You do not have permission to delete this property');
    }

    // Non-admin users can only archive active or sold properties
    if (!isAdmin && property.status !== 'active' && property.status !== 'sold') {
      this.logger.warn(`User ${userId} attempted to archive property ${id} with status "${property.status}"`, {
        fileName: 'property.service.ts',
        functionName: 'remove',
        lineNumber: 242,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_CANNOT_ARCHIVE);
    }

    const updated = await this.propertyRepo.softDelete(id);

    await this.invalidateAll(id);
    return updated;
  }

  async hardDelete(id: string) {
    const property = await this.propertyRepo.findById(id);

    if (!property) {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'hardDelete',
        lineNumber: 250,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    await this.propertyRepo.hardDelete(id);

    await this.invalidateAll(id);
  }

  async addMedia(
    propertyId: string,
    file: Express.Multer.File,
    dto: CreatePropertyMediaDto,
    userId: string,
    isAdmin: boolean,
  ) {
    // 1. Check property exists
    const property = await this.propertyRepo.findById(propertyId);

    if (!property) {
      this.logger.warn(`Property not found: ${propertyId}`, {
        fileName: 'property.service.ts',
        functionName: 'addMedia',
        lineNumber: 271,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    // 2. Check ownership
    if (property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to add media to property ${propertyId} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'addMedia',
        lineNumber: 279,
      });
      throw new ForbiddenException('You do not have permission to add media to this property');
    }

    // 3. Count existing media of same type
    const existingCount = await this.propertyRepo.countMedia(propertyId, dto.media_type);
    const limit = dto.media_type === 'image'
      ? this.configService.get<number>('MAX_IMAGES_PER_PROPERTY', 20)
      : this.configService.get<number>('MAX_VIDEOS_PER_PROPERTY', 3);

    if (existingCount >= limit) {
      this.logger.warn(`Media limit reached for property: ${propertyId}`, {
        fileName: 'property.service.ts',
        functionName: 'addMedia',
        lineNumber: 292,
      });
      throw new AppException(PROPERTY_ERRORS.MEDIA_LIMIT_REACHED);
    }

    // 4. Determine folder and allowed types from the actual file, not from dto.media_type
    const isImage = file.mimetype.startsWith('image/');
    const actualMediaType = isImage ? 'image' : 'video';
    const folder = isImage
      ? UPLOAD_FOLDERS.PROPERTY_IMAGES.replace('{id}', propertyId)
      : UPLOAD_FOLDERS.PROPERTY_VIDEOS.replace('{id}', propertyId);
    const allowedMimetypes = isImage ? ALLOWED_MIMETYPES.IMAGES : ALLOWED_MIMETYPES.VIDEOS;
    const maxSizeMb = isImage ? UPLOAD_LIMITS_MB.IMAGE : UPLOAD_LIMITS_MB.VIDEO;

    this.logger.info(`addMedia — dto.media_type="${dto.media_type}", file.mimetype="${file.mimetype}", resolvedType="${actualMediaType}"`, {
      fileName: 'property.service.ts',
      functionName: 'addMedia',
      lineNumber: 305,
    });

    // 5. Upload to Cloudinary
    const uploaded = await this.uploadService.uploadFile(file, folder, allowedMimetypes, maxSizeMb);

    // 6. Determine display_order
    let displayOrder = dto.display_order;
    if (displayOrder === undefined) {
      const lastOrder = await this.propertyRepo.findLastMediaOrder(propertyId);
      displayOrder = (lastOrder ?? -1) + 1;
    }

    // 7. Save to DB — use actualMediaType derived from file, ignore user-provided dto.media_type
    let media:any;
    try{
     media = await this.propertyRepo.addMedia({
      property_id: propertyId,
      media_type: actualMediaType,
      url: uploaded.url,
      public_id: uploaded.public_id,
      thumbnail_url: uploaded.thumbnail_url ?? undefined,
      display_order: displayOrder,
    });
  }catch(dbError){
    // DB save failed — clean up the orphaned Cloudinary file immediately
      this.logger.warn(
        `DB save failed after Cloudinary upload — deleting orphaned file ${uploaded.public_id}`,
        {
          fileName:'property.service.ts',
          functionName: 'addMedia',
          lineNumber : 320,
        },
      );
      const cloudinaryResourceType = isImage ? 'image' : 'video';
      await this.uploadService.deleteFile(uploaded.public_id, cloudinaryResourceType);
      throw new AppException(PROPERTY_ERRORS.MEDIA_UPLOAD_FAILED);
  }
    await this.invalidateDetailCache(propertyId);

    this.logger.info(`PropertyMedia created: ${media.id} for property: ${propertyId}`, {
      fileName: 'property.service.ts',
      functionName: 'addMedia',
      lineNumber: 327,
    });

    return media;
  }

  async removeMedia(mediaId: string, userId: string, isAdmin: boolean) {
    // 1. Find media
    const media = await this.propertyRepo.findMediaById(mediaId);

    if (!media) {
      this.logger.warn(`Media not found: ${mediaId}`, {
        fileName: 'property.service.ts',
        functionName: 'removeMedia',
        lineNumber: 358,
      });
      throw new AppException(PROPERTY_ERRORS.MEDIA_NOT_FOUND);
    }

    // 2. Check ownership
    if (media.property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to remove media ${mediaId} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'removeMedia',
        lineNumber: 366,
      });
      throw new ForbiddenException('You do not have permission to remove this media');
    }

    // 3. Delete from DB FIRST (before Cloudinary)
    await this.propertyRepo.deleteMedia(mediaId);

    // 4. Then delete from Cloudinary (failure logged, not thrown)
    //    Pass media_type so videos are deleted with resource_type: 'video'
    const cloudinaryResourceType = media.media_type === 'video' ? 'video' : 'image';
    await this.uploadService.deleteFile(media.public_id, cloudinaryResourceType);

    await this.invalidateDetailCache(media.property_id);

    this.logger.info(`PropertyMedia deleted: ${mediaId} from property: ${media.property_id}`, {
      fileName: 'property.service.ts',
      functionName: 'removeMedia',
      lineNumber: 382,
    });
  }

  async findAllAdmin(query: PropertyQueryDto) {
    const queryParams = {
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sort_by: query.sort_by ?? 'created_at_desc',
    };

    return this.propertyRepo.findAllAdmin(queryParams);
  }

  // ── User Property Management ──────────────────────────────

  async findUserProperties(query: PropertyQueryDto, userId: string) {
    const queryParams = {
      ...query,
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sort_by: query.sort_by ?? 'created_at_desc',
    };

    return this.propertyRepo.findUserProperties(queryParams);
  }

  async submitForVerification(id: string, userId: string) {
    const property = await this.propertyRepo.findById(id);

    if (!property) {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'submitForVerification',
        lineNumber: 430,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (property.user_id !== userId) {
      this.logger.warn(`User ${userId} attempted to submit property ${id} without ownership`, {
        fileName: 'property.service.ts',
        functionName: 'submitForVerification',
        lineNumber: 437,
      });
      throw new ForbiddenException('You do not have permission to submit this property');
    }

    if (property.status !== 'draft') {
      this.logger.warn(`Cannot submit property ${id} with status "${property.status}" — must be draft`, {
        fileName: 'property.service.ts',
        functionName: 'submitForVerification',
        lineNumber: 444,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_CANNOT_SUBMIT);
    }

    // Validate all required fields are filled before submission
    const missingFields: string[] = [];
    if (!property.title) missingFields.push('title');
    if (!property.listing_type) missingFields.push('listing_type');
    if (!property.price || property.price <= 0) missingFields.push('price');

    if (missingFields.length > 0) {
      this.logger.warn(`Cannot submit property ${id} — missing required fields: ${missingFields.join(', ')}`, {
        fileName: 'property.service.ts',
        functionName: 'submitForVerification',
        lineNumber: 460,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_CANNOT_SUBMIT);
    }

    const updated = await this.propertyRepo.update(id, { status: 'pending' });

    await this.invalidateAll(id);

    this.logger.info(`Property ${id} submitted for verification`, {
      fileName: 'property.service.ts',
      functionName: 'submitForVerification',
      lineNumber: 470,
    });

    return updated;
  }
}
