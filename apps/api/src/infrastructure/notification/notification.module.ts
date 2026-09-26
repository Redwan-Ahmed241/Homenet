import { Module } from '@nestjs/common';
import { NOTIFICATION_SERVICE } from './constants.js';
import { PrismaNotificationService } from './services/prisma-notification.service.js';

@Module({
  providers: [
    {
      provide: NOTIFICATION_SERVICE,
      // Stored in the database so both portals can list them. Swap for
      // MockNotificationService in tests that should not touch Prisma.
      useClass: PrismaNotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationModule {}
