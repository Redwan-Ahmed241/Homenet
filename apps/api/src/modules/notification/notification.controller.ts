import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationService } from './notification.service.js';
import {
  NotificationAudienceDto,
  NotificationQueryDto,
} from './dto/notification-query.dto.js';

/**
 * FR-13 notifications. Signed-in users only (the global JWT guard applies).
 * `?audience=user` for the app, `?audience=admin` for the admin panel.
 */
@Controller('v1/notifications')
// The app polls the unread count once a minute. Without its own limit this
// controller falls under the global default of 10 requests per minute per IP,
// and behind shared IPs (office NAT, mobile carrier NAT) a few signed-in users
// would exhaust it between them.
@Throttle({ default: { limit: 120, ttl: 60000 } })
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  unreadCount(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationAudienceDto,
  ) {
    return this.notifications.unreadCount(user.id, query.audience);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationAudienceDto,
  ) {
    return this.notifications.markAllRead(user.id, query.audience);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }
}
