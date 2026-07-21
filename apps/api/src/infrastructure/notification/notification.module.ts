import { Module } from '@nestjs/common';
import { NOTIFICATION_SERVICE } from './constants.js';
import { MockNotificationService } from './services/mock-notification.service.js';

@Module({
  providers: [
    {
      provide: NOTIFICATION_SERVICE,
      useClass: MockNotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationModule {}
