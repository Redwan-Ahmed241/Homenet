import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { BACKGROUND_TASK_CONFIG } from '../background-task.constants.js';
import type { BackgroundTaskConfig } from '../background-task.constants.js';
import type { IBackgroundTaskService } from '../interfaces/background-task.service.interface.js';
import { VerificationService } from '../../../modules/verification/services/verification.service.js';

@Injectable()
export class PrototypeBackgroundTaskService implements IBackgroundTaskService {
  private readonly delayMs: number;

  constructor(
    @Inject(BACKGROUND_TASK_CONFIG)
    private readonly config: BackgroundTaskConfig,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => VerificationService))
    private readonly verificationService: VerificationService,
  ) {
    this.delayMs = this.config.verificationDelayMs ?? 3000;
  }

  async enqueueVerification(propertyId: string): Promise<void> {
    const fileName = 'prototype-background-task.service.ts';
    const functionName = 'enqueueVerification';

    this.logger.info(`Verification enqueued for property: ${propertyId}`, {
      fileName,
      functionName,
      lineNumber: 29,
    });

    // Schedule async — non-blocking, returns immediately
    setTimeout(() => {
      this.verificationService.processVerification(propertyId).catch((err) => {
        this.logger.error(
          `Verification failed for property: ${propertyId} — ${(err as Error).message}`,
          {
            fileName,
            functionName,
            lineNumber: 40,
          },
        );
      });
    }, this.delayMs);
  }
}
