import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { VerificationService } from '../../../modules/verification/services/verification.service.js';
import { BACKGROUND_TASK_CONFIG } from '../background-task.constants.js';
import type { BackgroundTaskConfig } from '../background-task.constants.js';
import { PrototypeBackgroundTaskService } from './prototype-background-task.service.js';

describe('PrototypeBackgroundTaskService', () => {
  let service: PrototypeBackgroundTaskService;
  let mockLogger: Record<string, jest.Mock>;
  const mockVerificationService = {
    processVerification: jest.fn().mockResolvedValue(undefined),
  };

  const defaultConfig: BackgroundTaskConfig = {
    verificationDelayMs: 3000,
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrototypeBackgroundTaskService,
        {
          provide: BACKGROUND_TASK_CONFIG,
          useValue: defaultConfig,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
        { provide: VerificationService, useValue: mockVerificationService },
      ],
    }).compile();

    service = module.get<PrototypeBackgroundTaskService>(PrototypeBackgroundTaskService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueVerification', () => {
    it('should resolve immediately without awaiting the delay', async () => {
      const promise = service.enqueueVerification('property-123');
      await expect(promise).resolves.toBeUndefined();
    });

    it('should log a message when verification is enqueued', async () => {
      await service.enqueueVerification('property-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Verification enqueued for property: property-123',
        expect.objectContaining({
          fileName: 'prototype-background-task.service.ts',
          functionName: 'enqueueVerification',
        }),
      );
    });

    it('should run verification after the configured delay', () => {
      service.enqueueVerification('property-456');

      // Before the delay, verification has not started
      expect(
        mockVerificationService.processVerification,
      ).not.toHaveBeenCalled();

      jest.advanceTimersByTime(3000);

      expect(mockVerificationService.processVerification).toHaveBeenCalledWith(
        'property-456',
      );
    });

    it('should use the configured delayMs from config', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PrototypeBackgroundTaskService,
          {
            provide: BACKGROUND_TASK_CONFIG,
            useValue: { verificationDelayMs: 5000 } satisfies BackgroundTaskConfig,
          },
          {
            provide: LoggerService,
            useValue: mockLogger,
          },
          { provide: VerificationService, useValue: mockVerificationService },
        ],
      }).compile();

      const customService =
        module.get<PrototypeBackgroundTaskService>(PrototypeBackgroundTaskService);
      const promise = customService.enqueueVerification('property-789');
      await expect(promise).resolves.toBeUndefined();

      // Not yet at 3000 ms
      jest.advanceTimersByTime(3000);
      expect(
        mockVerificationService.processVerification,
      ).not.toHaveBeenCalled();

      // Runs at 5000 ms
      jest.advanceTimersByTime(2000);
      expect(mockVerificationService.processVerification).toHaveBeenCalledWith(
        'property-789',
      );
    });
  });
});
