import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
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

@Injectable()
export class PropertyService {
  constructor(
    @Inject('IPropertyRepository') private readonly propertyRepo: IPropertyRepository,
    private readonly logger: LoggerService,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
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

  async create(dto: CreatePropertyDto, userId: string) {
    const area = await this.propertyRepo.findAreaById(dto.area_id);
    if (!area) {
      this.logger.warn(`Area not found: ${dto.area_id}`, {
        fileName: 'property.service.ts',
        functionName: 'create',
        lineNumber: 116,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (dto.amenities && Object.keys(dto.amenities).length > 0) {
      const valid = this.validateAmenities(dto.type, dto.amenities);
      if (!valid) {
        this.logger.warn(`Invalid amenities structure for property type ${dto.type}`, {
          fileName: 'property.service.ts',
          functionName: 'create',
          lineNumber: 125,
        });
        throw new AppException(PROPERTY_ERRORS.PROPERTY_INVALID_AMENITIES);
      }
    }

    const property = await this.propertyRepo.create({
      user_id: userId,
      area_id: dto.area_id,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      subtype: dto.subtype,
      listing_type: dto.listing_type,
      price: dto.price,
      price_currency: dto.price_currency,
      area_size: dto.area_size,
      area_unit: dto.area_unit,
      location_lat: dto.location_lat,
      location_lng: dto.location_lng,
      address: dto.address,
      amenities: dto.amenities,
      virtual_tour_url: dto.virtual_tour_url,
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

  async addMedia(propertyId: string, dto: CreatePropertyMediaDto, userId: string, isAdmin: boolean) {
    const property = await this.propertyRepo.findById(propertyId);

    if (!property) {
      this.logger.warn(`Property not found: ${propertyId}`, {
        fileName: 'property.service.ts',
        functionName: 'addMedia',
        lineNumber: 266,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to add media to property ${propertyId} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'addMedia',
        lineNumber: 273,
      });
      throw new ForbiddenException('You do not have permission to add media to this property');
    }

    let displayOrder = dto.display_order;
    if (displayOrder === undefined) {
      const lastOrder = await this.propertyRepo.findLastMediaOrder(propertyId);
      displayOrder = (lastOrder ?? -1) + 1;
    }

    const media = await this.propertyRepo.addMedia({
      property_id: propertyId,
      media_type: dto.media_type,
      url: dto.url,
      thumbnail_url: dto.thumbnail_url,
      display_order: displayOrder,
    });

    await this.invalidateDetailCache(propertyId);
    return media;
  }

  async removeMedia(mediaId: string, userId: string, isAdmin: boolean) {
    const media = await this.propertyRepo.findMediaById(mediaId);

    if (!media) {
      this.logger.warn(`Media not found: ${mediaId}`, {
        fileName: 'property.service.ts',
        functionName: 'removeMedia',
        lineNumber: 302,
      });
      throw new AppException(PROPERTY_ERRORS.MEDIA_NOT_FOUND);
    }

    if (media.property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to remove media ${mediaId} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'removeMedia',
        lineNumber: 309,
      });
      throw new ForbiddenException('You do not have permission to remove this media');
    }

    await this.propertyRepo.deleteMedia(mediaId);

    await this.invalidateDetailCache(media.property_id);
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
}
