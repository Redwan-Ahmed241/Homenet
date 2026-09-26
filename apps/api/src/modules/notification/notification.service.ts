import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import type {
  NotificationAudienceParam,
  NotificationQueryDto,
} from './dto/notification-query.dto.js';

/** Shape the app reads (src/types/api.ts `Notification` in the frontend). */
export interface NotificationResponse {
  id: string;
  user_id: string;
  audience: NotificationAudienceParam;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  read_at: Date | null;
  metadata: Prisma.JsonValue | null;
  created_at: Date;
}

function toResponse(row: Notification): NotificationResponse {
  return {
    id: row.id,
    user_id: row.user_id,
    audience: row.audience,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    read: row.read_at !== null,
    read_at: row.read_at,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

/**
 * Read side of FR-13. Every query is scoped to the signed-in user, so one
 * user can never list or mark another user's notifications.
 *
 * Never return a single notification at the top level of a response: the
 * global ResponseInterceptor lifts any top-level `message` field into the
 * envelope, which would swallow the notification's text. Lists nest them in
 * `items`, which is safe.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: NotificationQueryDto) {
    const audience = query.audience ?? 'user';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = {
      user_id: userId,
      audience,
      ...(query.unread_only ? { read_at: null } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: rows.map(toResponse),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  async unreadCount(
    userId: string,
    audience: NotificationAudienceParam = 'user',
  ) {
    const count = await this.prisma.notification.count({
      where: { user_id: userId, audience, read_at: null },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });

    // Nothing updated: either it was already read (fine) or it is not this
    // user's notification (reported as not found, so ids cannot be probed).
    if (count === 0) {
      const owned = await this.prisma.notification.count({
        where: { id, user_id: userId },
      });
      if (owned === 0) throw new NotFoundException('Notification not found');
    }
    return { id, read: true };
  }

  async markAllRead(
    userId: string,
    audience: NotificationAudienceParam = 'user',
  ) {
    const { count } = await this.prisma.notification.updateMany({
      where: { user_id: userId, audience, read_at: null },
      data: { read_at: new Date() },
    });
    return { updated: count };
  }
}
