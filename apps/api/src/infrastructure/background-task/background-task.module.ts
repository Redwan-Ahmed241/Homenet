import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BACKGROUND_TASK_SERVICE, BACKGROUND_TASK_CONFIG } from './background-task.constants.js';
import type { BackgroundTaskConfig } from './background-task.constants.js';
import { PrototypeBackgroundTaskService } from './services/prototype-background-task.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: BACKGROUND_TASK_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): BackgroundTaskConfig => ({
        verificationDelayMs: config.get<number>(
          'BACKGROUND_VERIFICATION_DELAY_MS',
          3000,
        ),
      }),
    },
    {
      provide: BACKGROUND_TASK_SERVICE,
      useClass: PrototypeBackgroundTaskService,
    },
  ],
  exports: [BACKGROUND_TASK_SERVICE],
})
export class BackgroundTaskModule {}
