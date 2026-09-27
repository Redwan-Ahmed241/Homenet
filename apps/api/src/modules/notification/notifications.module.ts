import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';

/**
 * The notifications API (FR-13). Writing notifications is handled separately
 * by src/infrastructure/notification, driven by events.
 */
@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationsModule {}
