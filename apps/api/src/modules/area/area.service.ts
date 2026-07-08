import { Injectable, Inject } from '@nestjs/common';
import type { ICacheService } from '../../common/cache/cache.service.interface.js';
import { CACHE_TTL } from '../../common/cache/cache.service.interface.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { AREA_ERRORS } from '../../common/errors/error-codes.js';
import { CreateAreaDto } from './dto/create-area.dto.js';
import { UpdateAreaDto } from './dto/update-area.dto.js';
import { AreaQueryDto } from './dto/area-query.dto.js';
import type { IAreaRepository } from './interfaces/area-repository.interface.js';

@Injectable()
export class AreaService {
  constructor(
    @Inject('IAreaRepository') private readonly areaRepo: IAreaRepository,
    private readonly logger: LoggerService,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
  ) {}

  async findAll(query: AreaQueryDto) {
    const cacheKey = 'areas:list';
    return this.cacheService.getOrSet(cacheKey, async () => {
      const { city, parent_area_id, search, page = 1, limit = 20 } = query;
      const skip = (page - 1) * limit;

      const where: Record<string, any> = {};
      if (city) where.city = city;
      if (parent_area_id !== undefined) where.parent_area_id = parent_area_id;
      if (search) where.name = { contains: search, mode: 'insensitive' };

      const { items, total } = await this.areaRepo.findManyWithCount({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      });

      return { items, total, page, limit, total_pages: Math.ceil(total / limit) };
    }, CACHE_TTL.LIST);
  }

  async findOne(id: string) {
    const cacheKey = `areas:detail:${id}`;
    return this.cacheService.getOrSet(cacheKey, async () => {
      const area = await this.areaRepo.findDetail(id);

      if (!area) {
        this.logger.warn(`Area not found: ${id}`, {
          fileName: 'area.service.ts',
          functionName: 'findOne',
          lineNumber: 56,
        });
        throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
      }

      return area;
    }, CACHE_TTL.DETAIL);
  }

  async findChildren(id: string) {
    const cacheKey = `areas:children:${id}`;
    return this.cacheService.getOrSet(cacheKey, async () => {
      const parent = await this.areaRepo.findById(id);
      if (!parent) {
        this.logger.warn(`Area not found: ${id}`, {
          fileName: 'area.service.ts',
          functionName: 'findChildren',
          lineNumber: 73,
        });
        throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
      }

      return this.areaRepo.findChildren(id);
    }, CACHE_TTL.LIST);
  }

  async create(dto: CreateAreaDto) {
    const city = dto.city ?? 'Dhaka';

    const existing = await this.areaRepo.findByNameAndCity(dto.name, city);
    if (existing) {
      this.logger.warn(`Duplicate area creation attempted: ${dto.name}, ${city}`, {
        fileName: 'area.service.ts',
        functionName: 'create',
        lineNumber: 89,
      });
      throw new AppException(AREA_ERRORS.AREA_ALREADY_EXISTS);
    }

    const area = await this.areaRepo.create({
      name: dto.name,
      parent_area_id: dto.parent_area_id ?? null,
      city,
    });

    await this.areaRepo.updateGeometry(area.id, dto.boundary, dto.centroid);

    await this.cacheService.del('areas:list');

    return area;
  }

  async update(id: string, dto: UpdateAreaDto) {
    const area = await this.areaRepo.findById(id);

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'update',
        lineNumber: 112,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.parent_area_id !== undefined) {
      updateData.parent = dto.parent_area_id
        ? { connect: { id: dto.parent_area_id } }
        : { disconnect: true };
    }
    if (dto.city !== undefined) updateData.city = dto.city;

    await this.areaRepo.update(id, updateData);

    await this.areaRepo.updateGeometry(id, dto.boundary, dto.centroid);

    await this.cacheService.delMany(['areas:list', `areas:detail:${id}`]);

    this.logger.info(`Area updated: ${id}`, {
      fileName: 'area.service.ts',
      functionName: 'update',
      lineNumber: 134,
    });

    return { id };
  }

  async delete(id: string) {
    const area = await this.areaRepo.findById(id);

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'delete',
        lineNumber: 146,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    const propertyCount = await this.areaRepo.countActiveProperties(id);
    if (propertyCount > 0) {
      this.logger.warn(`Delete blocked — area ${id} has active listings`, {
        fileName: 'area.service.ts',
        functionName: 'delete',
        lineNumber: 154,
      });
      throw new AppException(AREA_ERRORS.AREA_HAS_ACTIVE_LISTINGS);
    }

    await this.areaRepo.delete(id);

    await this.cacheService.delMany(['areas:list', `areas:detail:${id}`]);

    this.logger.info(`Area deleted: ${id}`, {
      fileName: 'area.service.ts',
      functionName: 'delete',
      lineNumber: 167,
    });

    return { message: 'Area deleted successfully' };
  }
}
