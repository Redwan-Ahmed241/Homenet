import { Test, TestingModule } from '@nestjs/testing';
import { PropertyService } from '../../../src/modules/property/property.service.js';
import { PrismaPropertyRepository } from '../../../src/modules/property/repositories/prisma-property.repository.js';
import { LoggerService } from '../../../src/common/logger/logger.service.js';
import { ConfigService } from '@nestjs/config';
import { BACKGROUND_TASK_SERVICE } from '../../../src/infrastructure/background-task/background-task.constants.js';

describe('Property Module Search & Filtering', () => {
  describe('PrismaPropertyRepository - buildWhereFromQuery', () => {
    let repo: PrismaPropertyRepository;
    const mockPrismaService: any = {
      property: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    const mockLoggerService: any = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    };

    beforeEach(() => {
      repo = new PrismaPropertyRepository(mockPrismaService, mockLoggerService);
    });

    it('should search across title, description, address, area name, and area city when search is provided', () => {
      const where = (repo as any).buildWhereFromQuery({
        search: 'dhaka',
        page: 1,
        limit: 20,
      });

      expect(where.OR).toEqual([
        { title: { contains: 'dhaka', mode: 'insensitive' } },
        { description: { contains: 'dhaka', mode: 'insensitive' } },
        { address: { contains: 'dhaka', mode: 'insensitive' } },
        { area: { name: { contains: 'dhaka', mode: 'insensitive' } } },
        { area: { city: { contains: 'dhaka', mode: 'insensitive' } } },
      ]);
    });

    it('should support query alias for search in buildWhereFromQuery', () => {
      const where = (repo as any).buildWhereFromQuery({
        query: 'gulshan',
        page: 1,
        limit: 20,
      });

      expect(where.OR).toEqual([
        { title: { contains: 'gulshan', mode: 'insensitive' } },
        { description: { contains: 'gulshan', mode: 'insensitive' } },
        { address: { contains: 'gulshan', mode: 'insensitive' } },
        { area: { name: { contains: 'gulshan', mode: 'insensitive' } } },
        { area: { city: { contains: 'gulshan', mode: 'insensitive' } } },
      ]);
    });

    it('should match city with case-insensitive equals', () => {
      const where = (repo as any).buildWhereFromQuery({
        city: 'dhaka',
        page: 1,
        limit: 20,
      });

      expect(where.area).toEqual({
        city: { equals: 'dhaka', mode: 'insensitive' },
      });
    });

    it('should support location alias for city with case-insensitive equals', () => {
      const where = (repo as any).buildWhereFromQuery({
        location: 'Chattogram',
        page: 1,
        limit: 20,
      });

      expect(where.area).toEqual({
        city: { equals: 'Chattogram', mode: 'insensitive' },
      });
    });
  });

  describe('PropertyService - Query Normalization', () => {
    let service: PropertyService;
    const mockRepo: any = {
      findPublished: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findAllAdmin: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findUserProperties: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const mockLogger: any = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    };
    const mockCache: any = {
      generateKey: jest.fn().mockReturnValue('test-cache-key'),
      getOrSet: jest.fn().mockImplementation((key, factory) => factory()),
    };
    const mockConfig: any = {
      get: jest.fn(),
    };
    const mockBackgroundTask: any = {
      enqueueVerification: jest.fn(),
    };
    const mockUpload: any = {};

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PropertyService,
          { provide: 'IPropertyRepository', useValue: mockRepo },
          { provide: LoggerService, useValue: mockLogger },
          { provide: 'ICacheService', useValue: mockCache },
          { provide: 'IUploadService', useValue: mockUpload },
          { provide: ConfigService, useValue: mockConfig },
          { provide: BACKGROUND_TASK_SERVICE, useValue: mockBackgroundTask },
        ],
      }).compile();

      service = module.get<PropertyService>(PropertyService);
    });

    it('should normalize query into search and location into city in findAll', async () => {
      await service.findAll({
        query: 'dhaka',
        location: 'dhaka',
      } as any);

      expect(mockRepo.findPublished).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'dhaka',
          city: 'dhaka',
        }),
      );
    });

    it('should normalize query into search and location into city in findAllAdmin', async () => {
      await service.findAllAdmin({
        query: 'banani',
        location: 'dhaka',
      } as any);

      expect(mockRepo.findAllAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'banani',
          city: 'dhaka',
        }),
      );
    });

    it('should normalize query into search and location into city in findUserProperties', async () => {
      await service.findUserProperties(
        { query: 'penthouse', location: 'dhaka' } as any,
        'user-123',
      );

      expect(mockRepo.findUserProperties).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'penthouse',
          city: 'dhaka',
          userId: 'user-123',
        }),
      );
    });
  });
});
