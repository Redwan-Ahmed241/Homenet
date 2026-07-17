import { Injectable, Inject } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { BACKGROUND_TASK_CONFIG } from '../background-task.constants.js';
import type { BackgroundTaskConfig } from '../background-task.constants.js';
import type { IBackgroundTaskService } from '../interfaces/background-task.service.interface.js';

@Injectable()
export class PrototypeBackgroundTaskService implements IBackgroundTaskService {
  private readonly delayMs: number;

  constructor(
    @Inject(BACKGROUND_TASK_CONFIG)
    private readonly config: BackgroundTaskConfig,
    private readonly logger: LoggerService,
  ) {
    this.delayMs = this.config.verificationDelayMs ?? 3000;
  }

  async enqueueVerification(propertyId: string): Promise<void> {
    const fileName = 'prototype-background-task.service.ts';
    const functionName = 'enqueueVerification';

    this.logger.info(`Verification enqueued for property: ${propertyId}`, {
      fileName,
      functionName,
      lineNumber: 25,
    });

    // Schedule async — non-blocking, returns immediately
    // TODO Phase 3: inject VerificationService and call processVerification()
    setTimeout(() => {
      this.logger.info(
        `Background task triggered for property: ${propertyId}`,
        {
          fileName,
          functionName,
          lineNumber: 34,
        },
      );
    }, this.delayMs);
  }
}
