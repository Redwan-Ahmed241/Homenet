import { Injectable, Inject, ForbiddenException, ConflictException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { PROPERTY_ERRORS } from '../../common/errors/error-codes.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertyQueryDto } from './dto/property-query.dto.js';
import { CreatePropertyMediaDto } from './dto/create-property-media.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ── Helpers ─────────────────────────────────────────────

  private generateCacheKey(prefix: string, data: any): string {
    return `${prefix}:${JSON.stringify(data)}`;
  }

  private async invalidateListCache() {
    // For the default cache manager, we store a versioned key or delete specific keys.
    // Since pattern deletion is not supported, we use a fixed key for list caches
    // that gets overwritten on each query and deleted on mutation.
    // Also delete individual list keys that may exist.
    await this.cacheManager.del('properties:list:all');
    this.logger.debug('Cache invalidated: properties:list:*', {
      fileName: 'property.service.ts',
      functionName: 'invalidateListCache',
      lineNumber: 45,
    });
  }

  private async invalidateDetailCache(id: string) {
    await this.cacheManager.del(`properties:detail:${id}`);
    await this.cacheManager.del(`properties:media:${id}`);
    this.logger.debug(`Cache invalidated: properties:detail:${id}, properties:media:${id}`, {
      fileName: 'property.service.ts',
      functionName: 'invalidateDetailCache',
      lineNumber: 53,
    });
  }

  private async invalidateAll(id: string) {
    await this.invalidateListCache();
    await this.invalidateDetailCache(id);
  }

  private validateAmenities(type: string, amenities: Record<string, any>): boolean {
    switch (type) {
      case 'residential':
        // bedrooms, bathrooms are expected; others optional
        return true;
      case 'commercial':
        return true;
      case 'land':
        return true;
      case 'parking':
        return true;
      default:
        return false;
    }
  }

  private readonly propertyPublicSelect: Prisma.PropertySelect = {
    id: true,
    user_id: true,
    area_id: true,
    title: true,
    description: true,
    type: true,
    subtype: true,
    listing_type: true,
    price: true,
    price_currency: true,
    area_size: true,
    area_unit: true,
    location_lat: true,
    location_lng: true,
    address: true,
    amenities: true,
    status: true,
    is_verified: true,
    virtual_tour_url: true,
    view_count: true,
    published_at: true,
    created_at: true,
    updated_at: true,
  };

  // ── Public: List active properties ──────────────────────

  async findAll(query: PropertyQueryDto) {
    const cacheKey = this.generateCacheKey('properties:list', query);
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`, {
        fileName: 'property.service.ts',
        functionName: 'findAll',
        lineNumber: 96,
      });
      return cached;
    }

    this.logger.debug(`Cache miss: ${cacheKey}`, {
      fileName: 'property.service.ts',
      functionName: 'findAll',
      lineNumber: 102,
    });

    const {
      city,
      area_id,
      type,
      listing_type,
      min_price,
      max_price,
      min_area,
      max_area,
      bedrooms,
      bathrooms,
      search,
      is_verified,
      sort_by = 'created_at_desc',
      page = 1,
      limit = 20,
      lat,
      lng,
      radius,
    } = query;

    const skip = (page - 1) * limit;

    // Build WHERE clause
    const where: Prisma.PropertyWhereInput = {
      status: 'active',
    };

    if (area_id) {
      where.area_id = area_id;
    }

    if (type) {
      where.type = type;
    }

    if (listing_type) {
      where.listing_type = listing_type;
    }

    if (is_verified !== undefined) {
      where.is_verified = is_verified;
    }

    if (city) {
      where.area = { city };
    }

    // Price range
    if (min_price !== undefined || max_price !== undefined) {
      where.price = {};
      if (min_price !== undefined) {
        where.price.gte = min_price;
      }
      if (max_price !== undefined) {
        where.price.lte = max_price;
      }
    }

    // Area range
    if (min_area !== undefined || max_area !== undefined) {
      where.area_size = {};
      if (min_area !== undefined) {
        where.area_size.gte = min_area;
      }
      if (max_area !== undefined) {
        where.area_size.lte = max_area;
      }
    }

    // JSONB amenities filtering
    if (bedrooms !== undefined) {
      where.amenities = {
        path: ['bedrooms'],
        equals: bedrooms,
      };
    }

    if (bathrooms !== undefined) {
      const amenitiesFilter: any = where.amenities ? { ...where.amenities } : {};
      where.amenities = {
        ...amenitiesFilter,
        path: ['bathrooms'],
        equals: bathrooms,
      };
    }

    // Search (title or description)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Sort order
    let orderBy: Prisma.PropertyOrderByWithRelationInput = { created_at: 'desc' };
    switch (sort_by) {
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'created_at_asc':
        orderBy = { created_at: 'asc' };
        break;
      case 'created_at_desc':
        orderBy = { created_at: 'desc' };
        break;
      case 'view_count_desc':
        orderBy = { view_count: 'desc' };
        break;
    }

    // Proximity search
    if (lat !== undefined && lng !== undefined && radius !== undefined) {
      // When proximity is requested, we use raw query approach
      // Build the list using PostGIS-like distance calculation with lat/lng
      // Using the Haversine formula approximation
      return this.findWithProximitySearch(
        where, orderBy, skip, limit, lat, lng, radius, cacheKey,
      );
    }

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        select: {
          ...this.propertyPublicSelect,
          area: {
            select: { id: true, name: true, city: true },
          },
          user: {
            select: { id: true, full_name: true, avatar_url: true },
          },
          media: {
            where: { media_type: 'image' },
            orderBy: { display_order: 'asc' },
            take: 1,
            select: { id: true, url: true, thumbnail_url: true },
          },
          _count: {
            select: { media: true },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.property.count({ where }),
    ]);

    const result = {
      items,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };

    // Cache for 300 seconds (5 minutes)
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  // ── Proximity Search ───────────────────────────────────

  private async findWithProximitySearch(
    baseWhere: Prisma.PropertyWhereInput,
    orderBy: Prisma.PropertyOrderByWithRelationInput,
    skip: number,
    limit: number,
    lat: number,
    lng: number,
    radius: number,
    cacheKey: string,
  ) {
    // Fetch all matching properties first (with proximity filter approximated)
    // Since we don't have PostGIS, we'll filter by a bounding box approximation
    const radiusKm = radius;
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

    const whereWithProximity: Prisma.PropertyWhereInput = {
      ...baseWhere,
      location_lat: { gte: lat - latDelta, lte: lat + latDelta },
      location_lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    };

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where: whereWithProximity,
        select: {
          ...this.propertyPublicSelect,
          area: {
            select: { id: true, name: true, city: true },
          },
          user: {
            select: { id: true, full_name: true, avatar_url: true },
          },
          media: {
            where: { media_type: 'image' },
            orderBy: { display_order: 'asc' },
            take: 1,
            select: { id: true, url: true, thumbnail_url: true },
          },
          _count: {
            select: { media: true },
          },
        },
        orderBy,
      }),
      this.prisma.property.count({ where: whereWithProximity }),
    ]);

    // Calculate exact distances and sort
    const itemsWithDistance = items.map((item) => {
      const distance = this.calculateDistance(
        lat, lng,
        item.location_lat ?? lat,
        item.location_lng ?? lng,
      );
      return { ...item, distance: Math.round(distance * 100) / 100 };
    });

    // Filter by exact radius and sort by distance
    const filtered = itemsWithDistance
      .filter((item) => item.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    const paginated = filtered.slice(skip, skip + limit);

    const result = {
      items: paginated,
      total: filtered.length,
      page: Math.floor(skip / limit) + 1,
      limit,
      total_pages: Math.ceil(filtered.length / limit),
    };

    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  // ── Haversine distance (km) ────────────────────────────

  private calculateDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ── Public: Get single property ────────────────────────

  async findOne(id: string) {
    const cacheKey = `properties:detail:${id}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`, {
        fileName: 'property.service.ts',
        functionName: 'findOne',
        lineNumber: 281,
      });
      return cached;
    }

    this.logger.debug(`Cache miss: ${cacheKey}`, {
      fileName: 'property.service.ts',
      functionName: 'findOne',
      lineNumber: 288,
    });

    const property = await this.prisma.property.findUnique({
      where: { id },
      select: {
        ...this.propertyPublicSelect,
        area: {
          select: {
            id: true,
            name: true,
            city: true,
            parent: { select: { id: true, name: true } },
          },
        },
        user: {
          select: {
            id: true,
            full_name: true,
            avatar_url: true,
            auth_identities: {
              where: { provider: 'LOCAL' },
              select: { email: true, phone: true },
              take: 1,
            },
          },
        },
        media: {
          orderBy: { display_order: 'asc' },
          select: { id: true, media_type: true, url: true, thumbnail_url: true, display_order: true },
        },
        _count: {
          select: { media: true },
        },
      },
    });

    if (!property || property.status !== 'active') {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'findOne',
        lineNumber: 318,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    // Increment view_count asynchronously
    await this.prisma.property.update({
      where: { id },
      data: { view_count: { increment: 1 } },
    });

    // Update the cached view count
    property.view_count += 1;

    // Cache for 600 seconds (10 minutes)
    await this.cacheManager.set(cacheKey, property, 600);
    return property;
  }

  // ── Authenticated: Create property ─────────────────────

  async create(dto: CreatePropertyDto, userId: string) {
    // Validate area exists
    const area = await this.prisma.area.findUnique({ where: { id: dto.area_id } });
    if (!area) {
      this.logger.warn(`Area not found: ${dto.area_id}`, {
        fileName: 'property.service.ts',
        functionName: 'create',
        lineNumber: 341,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    // Validate amenities if provided
    if (dto.amenities && Object.keys(dto.amenities).length > 0) {
      const valid = this.validateAmenities(dto.type, dto.amenities);
      if (!valid) {
        this.logger.warn(`Invalid amenities structure for property type ${dto.type}`, {
          fileName: 'property.service.ts',
          functionName: 'create',
          lineNumber: 352,
        });
        throw new AppException(PROPERTY_ERRORS.PROPERTY_INVALID_AMENITIES);
      }
    }

    const property = await this.prisma.property.create({
      data: {
        user_id: userId,
        area_id: dto.area_id,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        subtype: dto.subtype,
        listing_type: dto.listing_type,
        price: dto.price,
        price_currency: dto.price_currency ?? 'BDT',
        area_size: dto.area_size,
        area_unit: dto.area_unit ?? 'sqft',
        location_lat: dto.location_lat ?? null,
        location_lng: dto.location_lng ?? null,
        address: dto.address,
        amenities: dto.amenities ?? Prisma.DbNull,
        virtual_tour_url: dto.virtual_tour_url,
        status: 'draft',
      },
    });

    this.logger.info(`Property created: ${property.id} - ${property.title}`, {
      fileName: 'property.service.ts',
      functionName: 'create',
      lineNumber: 380,
    });

    await this.invalidateListCache();
    return property;
  }

  // ── Authenticated: Update own property ─────────────────

  async update(id: string, dto: UpdatePropertyDto, userId: string, isAdmin: boolean) {
    const property = await this.prisma.property.findUnique({ where: { id } });

    if (!property) {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'update',
        lineNumber: 394,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to update property ${id} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'update',
        lineNumber: 401,
      });
      throw new ForbiddenException('You do not have permission to update this property');
    }

    // Validate area if changed
    if (dto.area_id) {
      const area = await this.prisma.area.findUnique({ where: { id: dto.area_id } });
      if (!area) {
        throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
      }
    }

    // Validate amenities if provided
    if (dto.amenities && Object.keys(dto.amenities).length > 0) {
      const type = dto.type ?? property.type;
      const valid = this.validateAmenities(type, dto.amenities);
      if (!valid) {
        this.logger.warn(`Invalid amenities structure for property type ${type}`, {
          fileName: 'property.service.ts',
          functionName: 'update',
          lineNumber: 420,
        });
        throw new AppException(PROPERTY_ERRORS.PROPERTY_INVALID_AMENITIES);
      }
    }

    // Build update data (only provided fields)
    const updateData: Prisma.PropertyUpdateInput = {};

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

    const updated = await this.prisma.property.update({
      where: { id },
      data: updateData,
    });

    this.logger.info(`Property updated: ${id}`, {
      fileName: 'property.service.ts',
      functionName: 'update',
      lineNumber: 457,
    });

    await this.invalidateAll(id);
    return updated;
  }

  // ── Authenticated: Soft delete own property ────────────

  async remove(id: string, userId: string, isAdmin: boolean) {
    const property = await this.prisma.property.findUnique({ where: { id } });

    if (!property) {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'remove',
        lineNumber: 471,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to delete property ${id} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'remove',
        lineNumber: 478,
      });
      throw new ForbiddenException('You do not have permission to delete this property');
    }

    // Soft delete - set status to archived
    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: 'archived' },
    });

    this.logger.info(`Property archived: ${id}`, {
      fileName: 'property.service.ts',
      functionName: 'remove',
      lineNumber: 487,
    });

    await this.invalidateAll(id);
    return updated;
  }

  // ── Admin: Hard delete ─────────────────────────────────

  async hardDelete(id: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });

    if (!property) {
      this.logger.warn(`Property not found: ${id}`, {
        fileName: 'property.service.ts',
        functionName: 'hardDelete',
        lineNumber: 500,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    await this.prisma.property.delete({ where: { id } });

    this.logger.info(`Property hard deleted: ${id} (admin)`, {
      fileName: 'property.service.ts',
      functionName: 'hardDelete',
      lineNumber: 507,
    });

    await this.invalidateAll(id);
  }

  // ── Authenticated: Add media ──────────────────────────

  async addMedia(propertyId: string, dto: CreatePropertyMediaDto, userId: string, isAdmin: boolean) {
    // Check property exists and belongs to user
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, user_id: true },
    });

    if (!property) {
      this.logger.warn(`Property not found: ${propertyId}`, {
        fileName: 'property.service.ts',
        functionName: 'addMedia',
        lineNumber: 523,
      });
      throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    }

    if (property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to add media to property ${propertyId} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'addMedia',
        lineNumber: 530,
      });
      throw new ForbiddenException('You do not have permission to add media to this property');
    }

    // If display_order not provided, append at end
    let displayOrder = dto.display_order;
    if (displayOrder === undefined) {
      const lastMedia = await this.prisma.propertyMedia.findFirst({
        where: { property_id: propertyId },
        orderBy: { display_order: 'desc' },
        select: { display_order: true },
      });
      displayOrder = (lastMedia?.display_order ?? -1) + 1;
    }

    const media = await this.prisma.propertyMedia.create({
      data: {
        property_id: propertyId,
        media_type: dto.media_type,
        url: dto.url,
        thumbnail_url: dto.thumbnail_url,
        display_order: displayOrder,
      },
    });

    this.logger.info(`Media added to property ${propertyId}: ${media.id}`, {
      fileName: 'property.service.ts',
      functionName: 'addMedia',
      lineNumber: 548,
    });

    await this.invalidateDetailCache(propertyId);
    return media;
  }

  // ── Authenticated: Remove media ───────────────────────

  async removeMedia(mediaId: string, userId: string, isAdmin: boolean) {
    const media = await this.prisma.propertyMedia.findUnique({
      where: { id: mediaId },
      include: {
        property: { select: { id: true, user_id: true } },
      },
    });

    if (!media) {
      this.logger.warn(`Media not found: ${mediaId}`, {
        fileName: 'property.service.ts',
        functionName: 'removeMedia',
        lineNumber: 564,
      });
      throw new AppException(PROPERTY_ERRORS.MEDIA_NOT_FOUND);
    }

    if (media.property.user_id !== userId && !isAdmin) {
      this.logger.warn(`User ${userId} attempted to remove media ${mediaId} without permission`, {
        fileName: 'property.service.ts',
        functionName: 'removeMedia',
        lineNumber: 571,
      });
      throw new ForbiddenException('You do not have permission to remove this media');
    }

    await this.prisma.propertyMedia.delete({ where: { id: mediaId } });

    this.logger.info(`Media removed: ${mediaId} from property ${media.property_id}`, {
      fileName: 'property.service.ts',
      functionName: 'removeMedia',
      lineNumber: 578,
    });

    await this.invalidateDetailCache(media.property_id);
  }

  // ── Admin: List all properties ─────────────────────────

  // ── Admin: List all properties ─────────────────────────

  async findAllAdmin(query: PropertyQueryDto) {
    const {
      city,
      area_id,
      type,
      listing_type,
      status,
      min_price,
      max_price,
      min_area,
      max_area,
      search,
      is_verified,
      sort_by = 'created_at_desc',
      page = 1,
      limit = 20,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.PropertyWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (area_id) {
      where.area_id = area_id;
    }

    if (type) {
      where.type = type;
    }

    if (listing_type) {
      where.listing_type = listing_type;
    }

    if (is_verified !== undefined) {
      where.is_verified = is_verified;
    }

    if (city) {
      where.area = { city };
    }

    // Price range
    if (min_price !== undefined || max_price !== undefined) {
      where.price = {};
      if (min_price !== undefined) where.price.gte = min_price;
      if (max_price !== undefined) where.price.lte = max_price;
    }

    // Area range
    if (min_area !== undefined || max_area !== undefined) {
      where.area_size = {};
      if (min_area !== undefined) where.area_size.gte = min_area;
      if (max_area !== undefined) where.area_size.lte = max_area;
    }

    // Search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Sort order
    let orderBy: Prisma.PropertyOrderByWithRelationInput = { created_at: 'desc' };
    switch (sort_by) {
      case 'price_asc': orderBy = { price: 'asc' }; break;
      case 'price_desc': orderBy = { price: 'desc' }; break;
      case 'created_at_asc': orderBy = { created_at: 'asc' }; break;
      case 'created_at_desc': orderBy = { created_at: 'desc' }; break;
      case 'view_count_desc': orderBy = { view_count: 'desc' }; break;
    }

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        select: {
          ...this.propertyPublicSelect,
          area: {
            select: { id: true, name: true, city: true },
          },
          user: {
            select: {
              id: true,
              full_name: true,
              avatar_url: true,
              auth_identities: {
                where: { provider: 'LOCAL' },
                select: { email: true, phone: true },
                take: 1,
              },
            },
          },
          media: {
            where: { media_type: 'image' },
            orderBy: { display_order: 'asc' },
            take: 1,
            select: { id: true, url: true, thumbnail_url: true },
          },
          _count: {
            select: { media: true },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }
}
