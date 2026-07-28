import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service.js';
import type { INotificationService, NotificationEvent } from '../interfaces/notification.service.interface.js';

@Injectable()
export class MockNotificationService implements INotificationService {
  constructor(private readonly logger: LoggerService) {}

  async send(userId: string, event: NotificationEvent): Promise<void> {
    const fileName = 'mock-notification.service.ts';
    const functionName = 'send';

    this.logger.info(
      `[MockNotification] User: ${userId} | Type: ${event.type} | Title: ${event.title} | Message: ${event.message}${event.metadata ? ` | Metadata: ${JSON.stringify(event.metadata)}` : ''}`,
      {
        fileName,
        functionName,
        lineNumber: 12,
      },
    );
  }
}
