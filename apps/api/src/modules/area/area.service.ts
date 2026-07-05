import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { AREA_ERRORS } from '../../common/errors/error-codes.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';
import { AreaQueryDto } from './dto/area-query.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class AreaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ── List / Query ────────────────────────────────────────

  async findAll(query: AreaQueryDto) {
    const cacheKey = 'areas:list';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit: areas:list', {
        fileName: 'area.service.ts',
        functionName: 'findAll',
        lineNumber: 28,
      });
      return cached;
    }

    this.logger.debug('Cache miss: areas:list', {
      fileName: 'area.service.ts',
      functionName: 'findAll',
      lineNumber: 35,
    });

    const { city, parent_area_id, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AreaWhereInput = {};

    if (city) {
      where.city = city;
    }

    if (parent_area_id !== undefined) {
      where.parent_area_id = parent_area_id;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.area.findMany({
        where,
        select: {
          id: true,
          name: true,
          parent_area_id: true,
          city: true,
          created_at: true,
          updated_at: true,
          _count: { select: { children: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.area.count({ where }),
    ]);

    const result = {
      items,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };

    await this.cacheManager.set(cacheKey, result, 300000);
    return result;
  }

  // ── Get by ID ──────────────────────────────────────────

  async findOne(id: string) {
    const cacheKey = `areas:detail:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: areas:detail:${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findOne',
        lineNumber: 79,
      });
      return cached;
    }

    this.logger.debug(`Cache miss: areas:detail:${id}`, {
      fileName: 'area.service.ts',
      functionName: 'findOne',
      lineNumber: 86,
    });

    const area = await this.prisma.area.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        parent_area_id: true,
        city: true,
        created_at: true,
        updated_at: true,
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
      },
    });

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findOne',
        lineNumber: 101,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    await this.cacheManager.set(cacheKey, area, 600000);
    return area;
  }

  // ── Get Children ───────────────────────────────────────

  async findChildren(id: string) {
    const cacheKey = `areas:children:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: areas:children:${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findChildren',
        lineNumber: 118,
      });
      return cached;
    }

    this.logger.debug(`Cache miss: areas:children:${id}`, {
      fileName: 'area.service.ts',
      functionName: 'findChildren',
      lineNumber: 125,
    });

    const parent = await this.prisma.area.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!parent) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findChildren',
        lineNumber: 133,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    const children = await this.prisma.area.findMany({
      where: { parent_area_id: id },
      select: {
        id: true,
        name: true,
        parent_area_id: true,
        city: true,
        created_at: true,
        updated_at: true,
        _count: { select: { children: true } },
      },
      orderBy: { name: 'asc' },
    });

    await this.cacheManager.set(cacheKey, children, 300000);
    return children;
  }

  // ── Create ─────────────────────────────────────────────

  async create(dto: CreateAreaDto) {
    const city = dto.city ?? 'Dhaka';

    // Check for duplicate
    const existing = await this.prisma.area.findFirst({
      where: { name: dto.name, city },
    });

    if (existing) {
      this.logger.warn(`Duplicate area creation attempted: ${dto.name}, ${city}`, {
        fileName: 'area.service.ts',
        functionName: 'create',
        lineNumber: 161,
      });
      throw new AppException(AREA_ERRORS.AREA_ALREADY_EXISTS);
    }

    // Create area record
    const area = await this.prisma.area.create({
      data: {
        name: dto.name,
        parent_area_id: dto.parent_area_id ?? null,
        city,
      },
    });

    // Store PostGIS geometry fields via raw queries if provided
    if (dto.boundary) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Area" SET boundary = ST_SetSRID(ST_GeomFromText('${dto.boundary}'), 4326) WHERE id = '${area.id}'`,
      );
    }

    if (dto.centroid) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Area" SET centroid = ST_SetSRID(ST_GeomFromText('${dto.centroid}'), 4326) WHERE id = '${area.id}'`,
      );
    }

    // Invalidate list cache
    await this.cacheManager.del('areas:list');
    this.logger.debug('Cache invalidated: areas:list', {
      fileName: 'area.service.ts',
      functionName: 'create',
      lineNumber: 193,
    });

    this.logger.info(`Area created: ${area.id} - ${area.name}`, {
      fileName: 'area.service.ts',
      functionName: 'create',
      lineNumber: 198,
    });

    return area;
  }

  // ── Update ─────────────────────────────────────────────

  async update(id: string, dto: UpdateAreaDto) {
    const area = await this.prisma.area.findUnique({ where: { id } });

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'update',
        lineNumber: 210,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    const updateData: Prisma.AreaUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.parent_area_id !== undefined) {
      updateData.parent = dto.parent_area_id
        ? { connect: { id: dto.parent_area_id } }
        : { disconnect: true };
    }
    if (dto.city !== undefined) updateData.city = dto.city;

    const updated = await this.prisma.area.update({
      where: { id },
      data: updateData,
    });

    // Update PostGIS fields via raw queries
    if (dto.boundary !== undefined) {
      if (dto.boundary) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET boundary = ST_SetSRID(ST_GeomFromText('${dto.boundary}'), 4326) WHERE id = '${id}'`,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET boundary = NULL WHERE id = '${id}'`,
        );
      }
    }

    if (dto.centroid !== undefined) {
      if (dto.centroid) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET centroid = ST_SetSRID(ST_GeomFromText('${dto.centroid}'), 4326) WHERE id = '${id}'`,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET centroid = NULL WHERE id = '${id}'`,
        );
      }
    }

    // Invalidate cache
    await this.cacheManager.del('areas:list');
    await this.cacheManager.del(`areas:detail:${id}`);
    if (area.parent_area_id) {
      await this.cacheManager.del(`areas:children:${area.parent_area_id}`);
    }
    this.logger.debug('Cache invalidated: areas:list', {
      fileName: 'area.service.ts',
      functionName: 'update',
      lineNumber: 262,
    });

    this.logger.info(`Area updated: ${id}`, {
      fileName: 'area.service.ts',
      functionName: 'update',
      lineNumber: 267,
    });

    return updated;
  }

  // ── Delete ─────────────────────────────────────────────

  async delete(id: string) {
    const area = await this.prisma.area.findUnique({ where: { id } });

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'delete',
        lineNumber: 279,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    // Check for active property listings
    const propertyCount = await this.prisma.property.count({
      where: { area_id: id },
    });

    if (propertyCount > 0) {
      this.logger.warn(`Delete blocked — area ${id} has active listings`, {
        fileName: 'area.service.ts',
        functionName: 'delete',
        lineNumber: 290,
      });
      throw new AppException(AREA_ERRORS.AREA_HAS_ACTIVE_LISTINGS);
    }

    await this.prisma.area.delete({ where: { id } });

    // Invalidate cache
    await this.cacheManager.del('areas:list');
    await this.cacheManager.del(`areas:detail:${id}`);
    if (area.parent_area_id) {
      await this.cacheManager.del(`areas:children:${area.parent_area_id}`);
    }
    this.logger.debug('Cache invalidated: areas:list', {
      fileName: 'area.service.ts',
      functionName: 'delete',
      lineNumber: 305,
    });

    this.logger.info(`Area deleted: ${id}`, {
      fileName: 'area.service.ts',
      functionName: 'delete',
      lineNumber: 310,
    });

    return { message: 'Area deleted successfully' };
  }
}
