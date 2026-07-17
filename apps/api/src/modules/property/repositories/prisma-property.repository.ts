import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { handlePrismaError } from '../../../common/database/prisma-error-handler.js';
import { PROPERTY_ERRORS } from '../../../common/errors/error-codes.js';
import type {
  IPropertyRepository,
  PropertyQueryParams,
  PropertyListItem,
  PropertyDetail,
  PaginatedResult,
  PropertyMedia,
} from '../interfaces/property-repository.interface.js';
import type { Verification, VerificationStatus } from '@prisma/client';

const propertyPublicSelect = {
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
} as const satisfies Prisma.PropertySelect;

@Injectable()
export class PrismaPropertyRepository implements IPropertyRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  private buildWhereFromQuery(query: PropertyQueryParams): Record<string, any> {
    const where: Record<string, any> = {};

    if (query.status) where.status = query.status;
    if (query.area_id) where.area_id = query.area_id;
    if (query.type) where.type = query.type;
    if (query.listing_type) where.listing_type = query.listing_type;
    if (query.is_verified !== undefined) where.is_verified = query.is_verified;
    if (query.city) where.area = { city: query.city };

    if (query.min_price !== undefined || query.max_price !== undefined) {
      where.price = {};
      if (query.min_price !== undefined) where.price.gte = query.min_price;
      if (query.max_price !== undefined) where.price.lte = query.max_price;
    }

    if (query.min_area !== undefined || query.max_area !== undefined) {
      where.area_size = {};
      if (query.min_area !== undefined) where.area_size.gte = query.min_area;
      if (query.max_area !== undefined) where.area_size.lte = query.max_area;
    }

    if (query.bedrooms !== undefined) {
      where.amenities = { path: ['bedrooms'], equals: query.bedrooms };
    }

    if (query.bathrooms !== undefined) {
      const amenitiesFilter: any = where.amenities ? { ...where.amenities } : {};
      where.amenities = { ...amenitiesFilter, path: ['bathrooms'], equals: query.bathrooms };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private buildOrderBy(sortBy?: string): Record<string, string> {
    switch (sortBy) {
      case 'price_asc': return { price: 'asc' };
      case 'price_desc': return { price: 'desc' };
      case 'created_at_asc': return { created_at: 'asc' };
      case 'created_at_desc': return { created_at: 'desc' };
      case 'view_count_desc': return { view_count: 'desc' };
      default: return { created_at: 'desc' };
    }
  }

  private readonly listIncludes = {
    area: { select: { id: true, name: true, city: true } },
    user: { select: { id: true, full_name: true, avatar_url: true } },
    media: {
      where: { media_type: 'image' as const },
      orderBy: { display_order: 'asc' as const },
      take: 1,
      select: { id: true, url: true, thumbnail_url: true },
    },
    _count: { select: { media: true } },
  } as const;

  async findPublished(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>> {
    const where: any = {
      ...this.buildWhereFromQuery(query),
      status: 'active',
    };
    const orderBy = this.buildOrderBy(query.sort_by);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        select: {
          ...propertyPublicSelect,
          ...this.listIncludes,
        } as any,
        skip,
        take: query.limit,
        orderBy,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items as unknown as PropertyListItem[],
      total,
      page: query.page,
      limit: query.limit,
      total_pages: Math.ceil(total / query.limit),
    };
  }

  async findWithProximitySearch(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>> {
    const radiusKm = query.radius!;
    const lat = query.lat!;
    const lng = query.lng!;
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

    const baseWhere: any = { ...this.buildWhereFromQuery(query), status: 'active' };
    const whereWithProximity: any = {
      ...baseWhere,
      location_lat: { gte: lat - latDelta, lte: lat + latDelta },
      location_lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    };
    const orderBy = this.buildOrderBy(query.sort_by);

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where: whereWithProximity,
        select: {
          ...propertyPublicSelect,
          ...this.listIncludes,
        } as any,
        orderBy,
      }),
      this.prisma.property.count({ where: whereWithProximity }),
    ]);

    const itemsWithDistance = items.map((item: any) => {
      const distance = this.calculateDistance(
        lat, lng,
        item.location_lat ?? lat,
        item.location_lng ?? lng,
      );
      return { ...item, distance: Math.round(distance * 100) / 100 };
    });

    const filtered = itemsWithDistance
      .filter((item: any) => item.distance <= radiusKm)
      .sort((a: any, b: any) => a.distance - b.distance);

    const skip = (query.page - 1) * query.limit;
    const paginated = filtered.slice(skip, skip + query.limit);

    return {
      items: paginated,
      total: filtered.length,
      page: Math.floor(skip / query.limit) + 1,
      limit: query.limit,
      total_pages: Math.ceil(filtered.length / query.limit),
    };
  }

  async findPublishedById(id: string): Promise<PropertyDetail | null> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: {
        ...propertyPublicSelect,
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
        _count: { select: { media: true } },
      } as any,
    });

    return property as unknown as PropertyDetail | null;
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.property.update({
      where: { id },
      data: { view_count: { increment: 1 } },
    });
  }

  async findById(id: string): Promise<{ id: string; user_id: string; type: string; status: string; title: string; listing_type: string; price: number } | null> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      select: { id: true, user_id: true, type: true, status: true, title: true, listing_type: true, price: true },
    });

    return property;
  }

  async create(data: {
    user_id: string;
    area_id: string;
    title: string;
    description?: string;
    type: string;
    subtype?: string;
    listing_type: string;
    price: number;
    price_currency?: string;
    area_size?: number;
    area_unit?: string;
    location_lat?: number | null;
    location_lng?: number | null;
    address?: string;
    amenities?: any;
    virtual_tour_url?: string;
    status?: string;
  }): Promise<{ id: string; title: string }> {
    const property = await this.prisma.property.create({
      data: {
        user_id: data.user_id,
        area_id: data.area_id,
        title: data.title,
        description: data.description,
        type: data.type as any,
        subtype: data.subtype,
        listing_type: data.listing_type as any,
        price: data.price,
        price_currency: data.price_currency ?? 'BDT',
        area_size: data.area_size,
        area_unit: data.area_unit ?? 'sqft',
        location_lat: data.location_lat ?? null,
        location_lng: data.location_lng ?? null,
        address: data.address,
        amenities: data.amenities ?? Prisma.DbNull,
        virtual_tour_url: data.virtual_tour_url,
        status: (data.status as any) ?? 'draft',
      },
      select: { id: true, title: true },
    });

    this.logger.info(`Property created: ${property.id} - ${property.title}`, {
      fileName: 'prisma-property.repository.ts',
      functionName: 'create',
      lineNumber: 229,
    });

    return property;
  }

  async update(id: string, data: Record<string, any>): Promise<{ id: string }> {
    try {
      const updated = await this.prisma.property.update({
        where: { id },
        data,
        select: { id: true },
      });

      this.logger.info(`Property updated: ${id}`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'update',
        lineNumber: 247,
      });

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update property: ${id}`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'update',
        lineNumber: 254,
      });
      handlePrismaError(error, {
        modelName: 'Property',
        notFoundError: PROPERTY_ERRORS.PROPERTY_NOT_FOUND,
      });
    }
  }

  async softDelete(id: string): Promise<{ id: string }> {
    try {
      const updated = await this.prisma.property.update({
        where: { id },
        data: { status: 'archived' },
        select: { id: true },
      });

      this.logger.info(`Property archived: ${id}`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'softDelete',
        lineNumber: 275,
      });

      return updated;
    } catch (error) {
      this.logger.error(`Failed to archive property: ${id}`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'softDelete',
        lineNumber: 282,
      });
      handlePrismaError(error, {
        modelName: 'Property',
        notFoundError: PROPERTY_ERRORS.PROPERTY_NOT_FOUND,
      });
    }
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await this.prisma.property.delete({ where: { id } });

      this.logger.info(`Property hard deleted: ${id} (admin)`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'hardDelete',
        lineNumber: 297,
      });
    } catch (error) {
      this.logger.error(`Failed to hard delete property: ${id}`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'hardDelete',
        lineNumber: 303,
      });
      handlePrismaError(error, {
        modelName: 'Property',
        notFoundError: PROPERTY_ERRORS.PROPERTY_NOT_FOUND,
      });
    }
  }

  async findAreaById(areaId: string): Promise<{ id: string } | null> {
    const area = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: { id: true },
    });

    return area;
  }

  async addMedia(data: {
    property_id: string;
    media_type: string;
    url: string;
    public_id: string;
    thumbnail_url?: string | null;
    display_order: number;
  }): Promise<PropertyMedia> {
    const media = await this.prisma.propertyMedia.create({
      data: {
        property_id: data.property_id,
        media_type: data.media_type as any,
        url: data.url,
        public_id: data.public_id,
        thumbnail_url: data.thumbnail_url,
        display_order: data.display_order,
      },
    });

    this.logger.info(`Media added to property ${data.property_id}: ${media.id}`, {
      fileName: 'prisma-property.repository.ts',
      functionName: 'addMedia',
      lineNumber: 345,
    });

    return media as unknown as PropertyMedia;
  }

  async findLastMediaOrder(propertyId: string): Promise<number | null> {
    const lastMedia = await this.prisma.propertyMedia.findFirst({
      where: { property_id: propertyId },
      orderBy: { display_order: 'desc' },
      select: { display_order: true },
    });

    return lastMedia?.display_order ?? null;
  }

  async countMedia(propertyId: string, mediaType: string): Promise<number> {
    const count = await this.prisma.propertyMedia.count({
      where: { property_id: propertyId, media_type: mediaType as any },
    });

    return count;
  }

  async findMediaById(mediaId: string): Promise<{
    id: string;
    property_id: string;
    public_id: string;
    media_type: string;
    property: { user_id: string };
  } | null> {
    const media = await this.prisma.propertyMedia.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        property_id: true,
        public_id: true,
        media_type: true,
        property: { select: { id: true, user_id: true } },
      },
    });

    if (!media) return null;

    return {
      id: media.id,
      property_id: media.property_id,
      public_id: media.public_id,
      media_type: media.media_type,
      property: { user_id: media.property.user_id },
    };
  }

  async deleteMedia(mediaId: string): Promise<void> {
    try {
      await this.prisma.propertyMedia.delete({ where: { id: mediaId } });

      this.logger.info(`Media removed: ${mediaId}`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'deleteMedia',
        lineNumber: 378,
      });
    } catch (error) {
      this.logger.error(`Failed to remove media: ${mediaId}`, {
        fileName: 'prisma-property.repository.ts',
        functionName: 'deleteMedia',
        lineNumber: 384,
      });
      handlePrismaError(error, {
        modelName: 'PropertyMedia',
        notFoundError: PROPERTY_ERRORS.MEDIA_NOT_FOUND,
      });
    }
  }

  async findAllAdmin(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>> {
    const where = this.buildWhereFromQuery(query);
    const orderBy = this.buildOrderBy(query.sort_by);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        select: {
          ...propertyPublicSelect,
          area: { select: { id: true, name: true, city: true } },
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
          _count: { select: { media: true } },
        } as any,
        skip,
        take: query.limit,
        orderBy,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items as unknown as PropertyListItem[],
      total,
      page: query.page,
      limit: query.limit,
      total_pages: Math.ceil(total / query.limit),
    };
  }

  async findUserProperties(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>> {
    const where: Record<string, any> = {
      ...this.buildWhereFromQuery(query),
      user_id: query.userId,
    };
    const orderBy = this.buildOrderBy(query.sort_by);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        select: {
          ...propertyPublicSelect,
          area: { select: { id: true, name: true, city: true } },
          media: {
            where: { media_type: 'image' as const },
            orderBy: { display_order: 'asc' as const },
            take: 1,
            select: { id: true, url: true, thumbnail_url: true },
          },
          _count: { select: { media: true } },
        } as any,
        skip,
        take: query.limit,
        orderBy,
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      items: items as unknown as PropertyListItem[],
      total,
      page: query.page,
      limit: query.limit,
      total_pages: Math.ceil(total / query.limit),
    };
  }

  async createVerification(propertyId: string): Promise<Verification> {
    const verification = await this.prisma.verification.create({
      data: {
        property_id: propertyId,
        status: 'pending',
      },
    });

    this.logger.debug(`Verification created for property: ${propertyId}`, {
      fileName: 'prisma-property.repository.ts',
      functionName: 'createVerification',
      lineNumber: 490,
    });

    return verification;
  }

  async updateVerificationStatus(
    propertyId: string,
    status: VerificationStatus,
    notes?: string,
  ): Promise<Verification> {
    const verification = await this.prisma.verification.update({
      where: { property_id: propertyId },
      data: {
        status,
        notes: notes ?? null,
        verified_at: status === 'verified' ? new Date() : null,
      },
    });

    this.logger.debug(
      `Verification status updated to ${status} for property: ${propertyId}`,
      {
        fileName: 'prisma-property.repository.ts',
        functionName: 'updateVerificationStatus',
        lineNumber: 515,
      },
    );

    return verification;
  }

  private calculateDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
  ): number {
    const R = 6371;
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
}
