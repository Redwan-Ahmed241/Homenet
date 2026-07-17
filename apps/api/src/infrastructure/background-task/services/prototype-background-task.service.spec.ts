import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { BACKGROUND_TASK_CONFIG } from '../background-task.constants.js';
import type { BackgroundTaskConfig } from '../background-task.constants.js';
import { PrototypeBackgroundTaskService } from './prototype-background-task.service.js';

describe('PrototypeBackgroundTaskService', () => {
  let service: PrototypeBackgroundTaskService;
  let mockLogger: Record<string, jest.Mock>;

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

    it('should log the background task trigger after the configured delay', () => {
      service.enqueueVerification('property-456');

      // Before delay — inner log should NOT have been called yet
      expect(mockLogger.info).toHaveBeenCalledTimes(1);

      // Advance all timers
      jest.advanceTimersByTime(3000);

      // After delay — inner log should have been called
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenLastCalledWith(
        'Background task triggered for property: property-456',
        expect.objectContaining({
          fileName: 'prototype-background-task.service.ts',
          functionName: 'enqueueVerification',
        }),
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
        ],
      }).compile();

      const customService =
        module.get<PrototypeBackgroundTaskService>(PrototypeBackgroundTaskService);
      const promise = customService.enqueueVerification('property-789');
      await expect(promise).resolves.toBeUndefined();

      // Should not have triggered at 3000ms
      jest.advanceTimersByTime(3000);
      expect(mockLogger.info).toHaveBeenCalledTimes(1); // Only the enqueue log

      // Should trigger at 5000ms
      jest.advanceTimersByTime(2000);
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });
});
