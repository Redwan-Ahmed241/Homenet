import { Test, TestingModule } from '@nestjs/testing';
import { PropertyService } from './property.service.js';
import { PropertyController } from './property.controller.js';
import { AppException } from '../../common/errors/app.exception.js';
import { LoggerService } from '../../common/logger/logger.service.js';
import { ConfigService } from '@nestjs/config';
import { BACKGROUND_TASK_SERVICE } from '../../infrastructure/background-task/background-task.constants.js';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor.js';
import { of, firstValueFrom } from 'rxjs';

describe('Saved Properties Feature', () => {
  let service: PropertyService;
  let controller: PropertyController;

  const mockPropertyRepo = {
    findSavedByUser: jest.fn(),
    findById: jest.fn(),
    saveProperty: jest.fn(),
    unsaveProperty: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delMany: jest.fn(),
    generateKey: jest.fn(),
    getOrSet: jest.fn(),
  };

  const mockUploadService = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const mockBackgroundTaskService = {
    enqueueVerification: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertyController],
      providers: [
        PropertyService,
        { provide: 'IPropertyRepository', useValue: mockPropertyRepo },
        { provide: LoggerService, useValue: mockLogger },
        { provide: 'ICacheService', useValue: mockCacheService },
        { provide: 'IUploadService', useValue: mockUploadService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: BACKGROUND_TASK_SERVICE, useValue: mockBackgroundTaskService },
      ],
    }).compile();

    service = module.get<PropertyService>(PropertyService);
    controller = module.get<PropertyController>(PropertyController);
  });

  describe('PropertyService.findSavedProperties', () => {
    it('should return empty list when user has no saved properties', async () => {
      mockPropertyRepo.findSavedByUser.mockResolvedValue([]);

      const result = await service.findSavedProperties('usr-1');

      expect(result).toEqual([]);
      expect(mockPropertyRepo.findSavedByUser).toHaveBeenCalledWith('usr-1');
    });

    it('should return properties list', async () => {
      const mockProps = [
        {
          id: 'prop-1',
          title: 'Cozy Apt',
          area: { id: 'area-1', name: 'Gulshan', parent_area_id: null, city: 'Dhaka' },
          media: [],
        },
      ];
      mockPropertyRepo.findSavedByUser.mockResolvedValue(mockProps);

      const result = await service.findSavedProperties('usr-1');

      expect(result).toEqual(mockProps);
    });
  });

  describe('PropertyService.saveProperty', () => {
    it('should throw AppException if property does not exist', async () => {
      mockPropertyRepo.findById.mockResolvedValue(null);

      await expect(service.saveProperty('non-existent', 'usr-1')).rejects.toThrow(
        AppException,
      );
      expect(mockPropertyRepo.saveProperty).not.toHaveBeenCalled();
    });

    it('should throw AppException if property is not active', async () => {
      mockPropertyRepo.findById.mockResolvedValue({ id: 'prop-1', status: 'archived' });

      await expect(service.saveProperty('prop-1', 'usr-1')).rejects.toThrow(
        AppException,
      );
      expect(mockPropertyRepo.saveProperty).not.toHaveBeenCalled();
    });

    it('should save property successfully when not previously saved', async () => {
      mockPropertyRepo.findById.mockResolvedValue({ id: 'prop-1', status: 'active' });
      mockPropertyRepo.saveProperty.mockResolvedValue({ alreadySaved: false });

      const result = await service.saveProperty('prop-1', 'usr-1');

      expect(result).toEqual({
        message: 'Property saved successfully',
        saved: true,
      });
      expect(mockPropertyRepo.saveProperty).toHaveBeenCalledWith('usr-1', 'prop-1');
    });

    it('should return already saved message when already saved', async () => {
      mockPropertyRepo.findById.mockResolvedValue({ id: 'prop-1', status: 'active' });
      mockPropertyRepo.saveProperty.mockResolvedValue({ alreadySaved: true });

      const result = await service.saveProperty('prop-1', 'usr-1');

      expect(result).toEqual({
        message: 'Property already saved',
        saved: true,
      });
    });
  });

  describe('PropertyService.unsaveProperty', () => {
    it('should throw AppException if property does not exist', async () => {
      mockPropertyRepo.findById.mockResolvedValue(null);

      await expect(service.unsaveProperty('non-existent', 'usr-1')).rejects.toThrow(
        AppException,
      );
      expect(mockPropertyRepo.unsaveProperty).not.toHaveBeenCalled();
    });

    it('should unsave property successfully when previously saved', async () => {
      mockPropertyRepo.findById.mockResolvedValue({ id: 'prop-1' });
      mockPropertyRepo.unsaveProperty.mockResolvedValue({ wasSaved: true });

      const result = await service.unsaveProperty('prop-1', 'usr-1');

      expect(result).toEqual({
        message: 'Property unsaved successfully',
        saved: false,
      });
      expect(mockPropertyRepo.unsaveProperty).toHaveBeenCalledWith('usr-1', 'prop-1');
    });

    it('should return was not saved message when not previously saved', async () => {
      mockPropertyRepo.findById.mockResolvedValue({ id: 'prop-1' });
      mockPropertyRepo.unsaveProperty.mockResolvedValue({ wasSaved: false });

      const result = await service.unsaveProperty('prop-1', 'usr-1');

      expect(result).toEqual({
        message: 'Property was not saved',
        saved: false,
      });
    });
  });

  describe('PropertyController routing handlers', () => {
    const mockUser: any = { id: 'usr-1', role: 'user' };

    it('findSavedProperties should delegate to service', async () => {
      jest.spyOn(service, 'findSavedProperties').mockResolvedValue([] as any);

      const res = await controller.findSavedProperties(mockUser);
      expect(service.findSavedProperties).toHaveBeenCalledWith('usr-1');
      expect(res).toEqual([]);
    });

    it('saveProperty should delegate to service', async () => {
      jest.spyOn(service, 'saveProperty').mockResolvedValue({
        message: 'Property saved successfully',
        saved: true,
      });

      const res = await controller.saveProperty('prop-1', mockUser);
      expect(service.saveProperty).toHaveBeenCalledWith('prop-1', 'usr-1');
      expect(res).toEqual({
        message: 'Property saved successfully',
        saved: true,
      });
    });

    it('unsaveProperty should delegate to service', async () => {
      jest.spyOn(service, 'unsaveProperty').mockResolvedValue({
        message: 'Property unsaved successfully',
        saved: false,
      });

      const res = await controller.unsaveProperty('prop-1', mockUser);
      expect(service.unsaveProperty).toHaveBeenCalledWith('prop-1', 'usr-1');
      expect(res).toEqual({
        message: 'Property unsaved successfully',
        saved: false,
      });
    });
  });

  describe('ResponseInterceptor Envelope Formatting', () => {
    const interceptor = new ResponseInterceptor();
    const mockContext: any = {};

    const runInterceptor = (val: any) => {
      const next: any = { handle: () => of(val) };
      return firstValueFrom(interceptor.intercept(mockContext, next));
    };

    it('formats populated saved properties array correctly', async () => {
      const input = [{ id: 'p1', title: 'Luxury Apt' }];
      const res = await runInterceptor(input);
      expect(res).toEqual({
        success: true,
        message: 'OK',
        data: [{ id: 'p1', title: 'Luxury Apt' }],
      });
    });

    it('formats empty saved properties list correctly', async () => {
      const input: any[] = [];
      const res = await runInterceptor(input);
      expect(res).toEqual({
        success: true,
        message: 'OK',
        data: [],
      });
    });

    it('formats save property success response correctly', async () => {
      const input = {
        message: 'Property saved successfully',
        saved: true,
      };
      const res = await runInterceptor(input);
      expect(res).toEqual({
        success: true,
        message: 'Property saved successfully',
        data: { saved: true },
      });
    });

    it('formats already saved response correctly', async () => {
      const input = {
        message: 'Property already saved',
        saved: true,
      };
      const res = await runInterceptor(input);
      expect(res).toEqual({
        success: true,
        message: 'Property already saved',
        data: { saved: true },
      });
    });

    it('formats unsave property success response correctly', async () => {
      const input = {
        message: 'Property unsaved successfully',
        saved: false,
      };
      const res = await runInterceptor(input);
      expect(res).toEqual({
        success: true,
        message: 'Property unsaved successfully',
        data: { saved: false },
      });
    });

    it('formats property was not saved response correctly', async () => {
      const input = {
        message: 'Property was not saved',
        saved: false,
      };
      const res = await runInterceptor(input);
      expect(res).toEqual({
        success: true,
        message: 'Property was not saved',
        data: { saved: false },
      });
    });
  });
});

