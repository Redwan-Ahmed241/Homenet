import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { handlePrismaError } from '../../../common/database/prisma-error-handler.js';
import { AREA_ERRORS } from '../../../common/errors/error-codes.js';
import type {
  IAreaRepository,
  AreaListItem,
  AreaDetail,
  AreaExists,
  AreaChildrenResult,
} from '../interfaces/area-repository.interface.js';

@Injectable()
export class PrismaAreaRepository implements IAreaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findManyWithCount(params: {
    where: Record<string, any>;
    skip: number;
    take: number;
    orderBy: Record<string, string>;
  }): Promise<{ items: AreaListItem[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.area.findMany({
        where: params.where,
        select: {
          id: true,
          name: true,
          parent_area_id: true,
          city: true,
          created_at: true,
          updated_at: true,
          _count: { select: { children: true } },
        },
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
      }),
      this.prisma.area.count({ where: params.where }),
    ]);

    return { items: items as unknown as AreaListItem[], total };
  }

  async findById(id: string): Promise<AreaExists | null> {
    const area = await this.prisma.area.findUnique({
      where: { id },
      select: { id: true },
    });

    return area;
  }

  async findDetail(id: string): Promise<AreaDetail | null> {
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
        fileName: 'prisma-area.repository.ts',
        functionName: 'findDetail',
        lineNumber: 67,
      });
      return null;
    }

    return area as unknown as AreaDetail;
  }

  async findChildren(id: string): Promise<AreaChildrenResult[]> {
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

    return children as unknown as AreaChildrenResult[];
  }

  async findByNameAndCity(name: string, city: string): Promise<AreaExists | null> {
    const existing = await this.prisma.area.findFirst({
      where: { name, city },
      select: { id: true },
    });

    return existing;
  }

  async create(data: { name: string; parent_area_id: string | null; city: string }): Promise<{ id: string; name: string }> {
    const area = await this.prisma.area.create({
      data: {
        name: data.name,
        parent_area_id: data.parent_area_id,
        city: data.city,
      },
      select: { id: true, name: true },
    });

    this.logger.info(`Area created: ${area.id} - ${area.name}`, {
      fileName: 'prisma-area.repository.ts',
      functionName: 'create',
      lineNumber: 113,
    });

    return area;
  }

  async update(id: string, data: Record<string, any>): Promise<{ id: string }> {
    try {
      const updated = await this.prisma.area.update({
        where: { id },
        data,
        select: { id: true },
      });

      this.logger.info(`Area updated: ${id}`, {
        fileName: 'prisma-area.repository.ts',
        functionName: 'update',
        lineNumber: 130,
      });

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update area: ${id}`, {
        fileName: 'prisma-area.repository.ts',
        functionName: 'update',
        lineNumber: 137,
      });
      handlePrismaError(error, {
        modelName: 'Area',
        notFoundError: AREA_ERRORS.AREA_NOT_FOUND,
      });
    }
  }

  async updateGeometry(id: string, boundary: string | undefined | null, centroid: string | undefined | null): Promise<void> {
    if (boundary !== undefined) {
      if (boundary) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET boundary = ST_SetSRID(ST_GeomFromText('${boundary}'), 4326) WHERE id = '${id}'`,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET boundary = NULL WHERE id = '${id}'`,
        );
      }
    }

    if (centroid !== undefined) {
      if (centroid) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET centroid = ST_SetSRID(ST_GeomFromText('${centroid}'), 4326) WHERE id = '${id}'`,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "Area" SET centroid = NULL WHERE id = '${id}'`,
        );
      }
    }
  }

  async countActiveProperties(areaId: string): Promise<number> {
    const count = await this.prisma.property.count({
      where: { area_id: areaId, status: 'active' },
    });

    return count;
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.area.delete({ where: { id } });

      this.logger.info(`Area deleted: ${id}`, {
        fileName: 'prisma-area.repository.ts',
        functionName: 'delete',
        lineNumber: 188,
      });
    } catch (error) {
      this.logger.error(`Failed to delete area: ${id}`, {
        fileName: 'prisma-area.repository.ts',
        functionName: 'delete',
        lineNumber: 194,
      });
      handlePrismaError(error, {
        modelName: 'Area',
        notFoundError: AREA_ERRORS.AREA_NOT_FOUND,
      });
    }
  }
}
