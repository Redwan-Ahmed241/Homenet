import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service.js';
import type {
  INotificationService,
  NotificationEvent,
} from '../interfaces/notification.service.interface.js';

/** Logs instead of storing. For tests and local runs without a database. */
@Injectable()
export class MockNotificationService implements INotificationService {
  constructor(private readonly logger: LoggerService) {}

  send(userId: string, event: NotificationEvent): Promise<void> {
    this.log(`User: ${userId}`, event);
    return Promise.resolve();
  }

  sendToMany(userIds: string[], event: NotificationEvent): Promise<void> {
    this.log(`Users: ${userIds.join(', ')}`, event);
    return Promise.resolve();
  }

  sendToAdmins(event: NotificationEvent): Promise<void> {
    this.log('Admins', { ...event, audience: 'admin' });
    return Promise.resolve();
  }

  private log(recipients: string, event: NotificationEvent) {
    const metadata = event.metadata
      ? ` | Metadata: ${JSON.stringify(event.metadata)}`
      : '';
    this.logger.info(
      `[MockNotification] ${recipients} | Audience: ${event.audience ?? 'user'} | Type: ${event.type} | Title: ${event.title} | Message: ${event.message}${metadata}`,
      {
        fileName: 'mock-notification.service.ts',
        functionName: 'log',
        lineNumber: 32,
      },
    );
  }
}
