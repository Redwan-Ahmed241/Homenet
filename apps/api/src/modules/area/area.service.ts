import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
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
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(query: AreaQueryDto) {
    const cacheKey = 'areas:list';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit: areas:list', {
        fileName: 'area.service.ts',
        functionName: 'findAll',
        lineNumber: 25,
      });
      return cached;
    }

    this.logger.debug('Cache miss: areas:list', {
      fileName: 'area.service.ts',
      functionName: 'findAll',
      lineNumber: 32,
    });

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

    const result = { items, total, page, limit, total_pages: Math.ceil(total / limit) };

    await this.cacheManager.set(cacheKey, result, 300000);
    return result;
  }

  async findOne(id: string) {
    const cacheKey = `areas:detail:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: areas:detail:${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findOne',
        lineNumber: 59,
      });
      return cached;
    }

    this.logger.debug(`Cache miss: areas:detail:${id}`, {
      fileName: 'area.service.ts',
      functionName: 'findOne',
      lineNumber: 66,
    });

    const area = await this.areaRepo.findDetail(id);

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findOne',
        lineNumber: 73,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    await this.cacheManager.set(cacheKey, area, 600000);
    return area;
  }

  async findChildren(id: string) {
    const cacheKey = `areas:children:${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: areas:children:${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findChildren',
        lineNumber: 88,
      });
      return cached;
    }

    this.logger.debug(`Cache miss: areas:children:${id}`, {
      fileName: 'area.service.ts',
      functionName: 'findChildren',
      lineNumber: 95,
    });

    const parent = await this.areaRepo.findById(id);
    if (!parent) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'findChildren',
        lineNumber: 100,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    const children = await this.areaRepo.findChildren(id);

    await this.cacheManager.set(cacheKey, children, 300000);
    return children;
  }

  async create(dto: CreateAreaDto) {
    const city = dto.city ?? 'Dhaka';

    const existing = await this.areaRepo.findByNameAndCity(dto.name, city);
    if (existing) {
      this.logger.warn(`Duplicate area creation attempted: ${dto.name}, ${city}`, {
        fileName: 'area.service.ts',
        functionName: 'create',
        lineNumber: 122,
      });
      throw new AppException(AREA_ERRORS.AREA_ALREADY_EXISTS);
    }

    const area = await this.areaRepo.create({
      name: dto.name,
      parent_area_id: dto.parent_area_id ?? null,
      city,
    });

    await this.areaRepo.updateGeometry(area.id, dto.boundary, dto.centroid);

    await this.cacheManager.del('areas:list');
    this.logger.debug('Cache invalidated: areas:list', {
      fileName: 'area.service.ts',
      functionName: 'create',
      lineNumber: 139,
    });

    return area;
  }

  async update(id: string, dto: UpdateAreaDto) {
    const area = await this.areaRepo.findById(id);

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'update',
        lineNumber: 150,
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

    await this.cacheManager.del('areas:list');
    await this.cacheManager.del(`areas:detail:${id}`);

    this.logger.info(`Area updated: ${id}`, {
      fileName: 'area.service.ts',
      functionName: 'update',
      lineNumber: 175,
    });

    return { id };
  }

  async delete(id: string) {
    const area = await this.areaRepo.findById(id);

    if (!area) {
      this.logger.warn(`Area not found: ${id}`, {
        fileName: 'area.service.ts',
        functionName: 'delete',
        lineNumber: 186,
      });
      throw new AppException(AREA_ERRORS.AREA_NOT_FOUND);
    }

    const propertyCount = await this.areaRepo.countActiveProperties(id);
    if (propertyCount > 0) {
      this.logger.warn(`Delete blocked — area ${id} has active listings`, {
        fileName: 'area.service.ts',
        functionName: 'delete',
        lineNumber: 194,
      });
      throw new AppException(AREA_ERRORS.AREA_HAS_ACTIVE_LISTINGS);
    }

    await this.areaRepo.delete(id);

    await this.cacheManager.del('areas:list');
    await this.cacheManager.del(`areas:detail:${id}`);

    this.logger.info(`Area deleted: ${id}`, {
      fileName: 'area.service.ts',
      functionName: 'delete',
      lineNumber: 209,
    });

    return { message: 'Area deleted successfully' };
  }
}
