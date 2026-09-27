import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import type {
  INotificationService,
  NotificationEvent,
} from '../interfaces/notification.service.interface.js';

/**
 * Stores notifications so the app and admin panel can list them (FR-13).
 *
 * Failures are logged and swallowed on purpose: a notification is a side
 * effect, and must never roll back or fail the action that triggered it — an
 * owner's submit or an admin's approval succeeds even if this write does not.
 */
@Injectable()
export class PrismaNotificationService implements INotificationService {
  /**
   * Who gets admin notifications. Not manage_properties: the default
   * buyer_seller role every signup receives holds it, so it would send every
   * new listing to every user. Only the admin role holds moderate_listing.
   */
  static readonly MODERATOR_PERMISSION = 'moderate_listing';

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async send(userId: string, event: NotificationEvent): Promise<void> {
    await this.sendToMany([userId], event);
  }

  async sendToMany(userIds: string[], event: NotificationEvent): Promise<void> {
    const recipients = [...new Set(userIds.filter(Boolean))];
    if (recipients.length === 0) return;

    try {
      await this.prisma.notification.createMany({
        data: recipients.map((userId) => ({
          user_id: userId,
          audience: event.audience ?? 'user',
          type: event.type,
          title: event.title,
          message: event.message,
          link: event.link ?? null,
          metadata: event.metadata
            ? (event.metadata as Prisma.InputJsonValue)
            : Prisma.DbNull,
        })),
      });
    } catch (error) {
      this.logger.error(
        `Failed to store "${event.type}" notification for ${recipients.length} user(s): ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          fileName: 'prisma-notification.service.ts',
          functionName: 'sendToMany',
          lineNumber: 55,
        },
      );
    }
  }

  async sendToAdmins(event: NotificationEvent): Promise<void> {
    try {
      const moderators = await this.prisma.user.findMany({
        where: {
          user_roles: {
            some: {
              role: {
                role_permissions: {
                  some: {
                    permission: {
                      name: PrismaNotificationService.MODERATOR_PERMISSION,
                    },
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });

      await this.sendToMany(
        moderators.map((moderator) => moderator.id),
        { ...event, audience: 'admin' },
      );
    } catch (error) {
      this.logger.error(
        `Failed to resolve moderators for "${event.type}" notification: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          fileName: 'prisma-notification.service.ts',
          functionName: 'sendToAdmins',
          lineNumber: 88,
        },
      );
    }
  }
}
