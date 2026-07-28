# SSE Real-Time In-App Notifications

## Overview

Add Server-Sent Events (SSE) to push real-time in-app notifications to authenticated users (web app & Android WebView). SSE is chosen over WebSocket because:

- Simpler protocol — plain HTTP, no handshake upgrade
- Auto-reconnect built into the browser/EventSource API
- Unidirectional (server → client) matches our notification use case perfectly
- Works through HTTP/2, proxies, and load balancers with no special config

## Architecture

```
Domain Event (EventEmitter)
        │
        ▼
┌────────────────────────────────────────────────────────────────┐
│                  NotificationService (orchestrator)            │
│  implements INotificationService                               │
│                                                                │
│  send(userId, event) {                                         │
│      1. prisma.notification.create(...)   // persist           │
│      2. sseConnection.send(...)           // push live         │
│      3. for each channel: channel.send()  // email/SMS/log    │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘
        │                    │                     │
        ▼                    ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Prisma      │  │ SseConnection   │  │ NotificationChannel[] │
│  Notification│  │ Manager         │  │  (providers)          │
│  Model       │  │                 │  │                       │
│              │  │ Map<userId,     │  │ ┌───────────────────┐ │
│              │  │   Response[]>   │  │ │LogChannel         │ │
│              │  │                 │  │ │(prev MockService) │ │
│              │  │                 │  │ ├───────────────────┤ │
│              │  │                 │  │ │EmailChannel       │ │
│              │  │                 │  │ │(future)           │ │
│              │  │                 │  │ ├───────────────────┤ │
│              │  │                 │  │ │SmsChannel         │ │
│              │  │                 │  │ │(future)           │ │
│              │  │                 │  │ └───────────────────┘ │
└──────────────┘  └──────────────────┘  └──────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  SseController                                               │
│  ┌──────────────────────────────────────────────────┐        │
│  │ GET  /v1/notifications/stream  → SSE connection   │        │
│  │ GET  /v1/notifications         → paginated history│        │
│  │ PATCH /v1/notifications/:id/read → mark read      │        │
│  │ PATCH /v1/notifications/read-all   → mark all read │        │
│  │ GET  /v1/notifications/unread-count → badge       │        │
│  └──────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

## Key Design — No Circular Dependency

The old decorator pattern had `SseNotificationService` injecting `INotificationService`, creating a cycle. The fix:

1. **`NotificationService`** is the single orchestrator — it implements `INotificationService` directly
2. **`NotificationChannel`** is a new interface for side-effect providers (log, email, SMS)
3. **`LogNotificationChannel`** replaces `MockNotificationService` — it implements `NotificationChannel`, not `INotificationService`
4. The `NOTIFICATION_SERVICE` token resolves to `NotificationService` — clean, linear dependency graph

```
NotificationService
  → PrismaService              (no cycle)
  → SseConnectionManagerService (no cycle)
  → NotificationChannel[]       (no cycle)
```

## New Files

### `prisma/schema.prisma` — add `Notification` model

```prisma
model Notification {
  id        String   @id @default(uuid())
  user_id   String
  type      String
  title     String
  message   String
  metadata  Json?
  read      Boolean  @default(false)
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id, created_at])
  @@index([user_id, read])
}
```

### `src/infrastructure/notification/interfaces/notification-channel.interface.ts`

New interface for pluggable delivery channels (log, email, SMS):

```typescript
export interface NotificationChannel {
  readonly name: string;
  send(userId: string, event: NotificationEvent): Promise<void>;
}
```

### `src/infrastructure/notification/sse/sse-connection-manager.service.ts`

Unchanged from original — manages active SSE connections per user.

```typescript
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../../../common/logger/logger.service.js';

@Injectable()
export class SseConnectionManagerService {
  private readonly connections = new Map<string, Response[]>();

  constructor(private readonly logger: LoggerService) {}

  add(userId: string, res: Response): void {
    const existing = this.connections.get(userId) ?? [];
    existing.push(res);
    this.connections.set(userId, existing);
    res.on('close', () => this.remove(userId, res));
  }

  remove(userId: string, res: Response): void {
    const conns = this.connections.get(userId);
    if (!conns) return;
    const filtered = conns.filter((c) => c !== res);
    if (filtered.length === 0) {
      this.connections.delete(userId);
    } else {
      this.connections.set(userId, filtered);
    }
  }

  send(userId: string, event: string, data: unknown): void {
    const conns = this.connections.get(userId);
    if (!conns) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of conns) {
      res.write(payload);
    }
  }

  connectionCount(userId: string): number {
    return this.connections.get(userId)?.length ?? 0;
  }

  totalConnections(): number {
    return this.connections.size;
  }
}
```

### `src/infrastructure/notification/services/notification.service.ts`

The single orchestrator — replaces `SseNotificationService` and the factory hack.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import type { INotificationService, NotificationEvent } from '../interfaces/notification.service.interface.js';
import type { NotificationChannel } from '../interfaces/notification-channel.interface.js';
import { SseConnectionManagerService } from '../sse/sse-connection-manager.service.js';

@Injectable()
export class NotificationService implements INotificationService {
  constructor(
    @Inject('NOTIFICATION_CHANNELS')
    private readonly channels: NotificationChannel[],
    private readonly connectionManager: SseConnectionManagerService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async send(userId: string, event: NotificationEvent): Promise<void> {
    const fileName = 'notification.service.ts';
    const functionName = 'send';

    // 1. Persist to database
    const notification = await this.prisma.notification.create({
      data: {
        user_id: userId,
        type: event.type,
        title: event.title,
        message: event.message,
        metadata: event.metadata ?? undefined,
      },
    });

    this.logger.info(
      `Notification persisted for user ${userId}: ${event.type}`,
      { fileName, functionName, lineNumber: 31 },
    );

    // 2. Push via SSE if user has active connection
    this.connectionManager.send(userId, 'notification', notification);

    // 3. Dispatch to all channels (log, email, SMS, etc.)
    await Promise.allSettled(
      this.channels.map((ch) =>
        ch.send(userId, event).catch((err) => {
          this.logger.error(
            `Channel ${ch.name} failed for user ${userId}`,
            { fileName, functionName, lineNumber: 42, error: err },
          );
        }),
      ),
    );
  }
}
```

### `src/infrastructure/notification/services/log-notification-channel.service.ts`

Renamed from `MockNotificationService` — now a channel, not the main service.

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service.js';
import type { NotificationChannel } from '../interfaces/notification-channel.interface.js';
import type { NotificationEvent } from '../interfaces/notification.service.interface.js';

@Injectable()
export class LogNotificationChannel implements NotificationChannel {
  readonly name = 'log';

  constructor(private readonly logger: LoggerService) {}

  async send(userId: string, event: NotificationEvent): Promise<void> {
    this.logger.info(
      `[LogChannel] User: ${userId} | Type: ${event.type} | Title: ${event.title} | Message: ${event.message}${event.metadata ? ` | Metadata: ${JSON.stringify(event.metadata)}` : ''}`,
      {
        fileName: 'log-notification-channel.service.ts',
        functionName: 'send',
        lineNumber: 14,
      },
    );
  }
}
```

### `src/infrastructure/notification/sse/sse.controller.ts`

Uses `@UseGuards(JwtAuthGuard)` explicitly at the class level. The SSE `stream` endpoint uses `@Res()` (no passthrough) to bypass the global `ResponseInterceptor` — SSE data must be raw `event:...\ndata:...\n\n` format, not wrapped in `{ success, data }`.

**Auth flow for the SSE stream:**
1. `JwtAuthGuard` (via Passport) intercepts the request **before** the handler
2. Extracts JWT from `Authorization: Bearer <token>`
3. Validates signature and expiry via `JwtStrategy.validate()`
4. Attaches `{ id, email }` to `req.user`
5. If invalid/missing — returns 401 before any SSE headers are written
6. If valid — handler runs, reads `req.user.id`, registers the SSE connection

The JWT is validated once at connection time. If the token expires mid-session, the SSE connection persists — the initial auth is trusted. To force re-auth on expiry, send a custom event from the server and have the client reconnect with a fresh token.

```typescript
import {
  Controller, Get, Patch, Param, Query,
  Req, Res, ParseIntPipe, DefaultValuePipe, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { SseConnectionManagerService } from './sse-connection-manager.service.js';
import { PrismaService } from '../../../common/database/prisma.service.js';

@ApiTags('Notifications')
@Controller('v1/notifications')
@UseGuards(JwtAuthGuard)
export class SseController {
  constructor(
    private readonly connectionManager: SseConnectionManagerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stream')
  @ApiOperation({ summary: 'SSE notification stream' })
  stream(@Req() req: Request, @Res() res: Response): void {
    const userId = (req.user as { id: string }).id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.connectionManager.add(userId, res);

    // Deliver unread notifications on connect
    this.prisma.notification
      .findMany({ where: { user_id: userId, read: false }, orderBy: { created_at: 'desc' } })
      .then((notifications) => {
        for (const n of notifications) {
          res.write(`event: notification\ndata: ${JSON.stringify(n)}\n\n`);
        }
      });

    // Heartbeat keeps proxies from closing idle connections
    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 30000);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.connectionManager.remove(userId, res);
    });
  }

  @Get()
  @ApiOperation({ summary: 'List notifications (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const userId = (req.user as { id: string }).id;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { user_id: userId } }),
    ]);

    return { data, total, page, limit };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { id: string }).id;
    await this.prisma.notification.updateMany({
      where: { id, user_id: userId },
      data: { read: true },
    });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    await this.prisma.notification.updateMany({
      where: { user_id: userId, read: false },
      data: { read: true },
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    const count = await this.prisma.notification.count({
      where: { user_id: userId, read: false },
    });
    return { count };
  }
}
```

### `src/infrastructure/notification/notification.module.ts` — updated

Clean registration — no factory, no circular dependency.

```typescript
import { Module } from '@nestjs/common';
import { NOTIFICATION_SERVICE } from './constants.js';
import { NotificationService } from './services/notification.service.js';
import { LogNotificationChannel } from './services/log-notification-channel.service.js';
import { SseConnectionManagerService } from './sse/sse-connection-manager.service.js';
import { SseController } from './sse/sse.controller.js';

@Module({
  controllers: [SseController],
  providers: [
    SseConnectionManagerService,
    NotificationService,
    LogNotificationChannel,
    {
      provide: 'NOTIFICATION_CHANNELS',
      useFactory: (...channels: import('./interfaces/notification-channel.interface.js').NotificationChannel[]) =>
        channels,
      inject: [LogNotificationChannel],
    },
    {
      provide: NOTIFICATION_SERVICE,
      useClass: NotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationModule {}
```

## Connection Lifecycle

```
Frontend                          Server
   │                                │
   │  GET /v1/notifications/stream  │
   │  Authorization: Bearer <JWT>   │
   │───────────────────────────────▶│
   │                                │  JwtAuthGuard validates token
   │                                │  Extract userId from req.user.id
   │                                │  Set SSE headers
   │                                │  Register connection
   │                                │  Replay unread notifications
   │  event: notification           │
   │  event: heartbeat (every 30s)  │
   │◀───────────────────────────────│
   │                                │
   │  (notification arrives)       │
   │  auto-reconnect if dropped     │
```

## Frontend Integration

### Web (fetch + ReadableStream)

`EventSource` doesn't support custom auth headers, so use `fetch`:

```typescript
async function connectSSE(token: string) {
  const response = await fetch('/v1/notifications/stream', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    let eventType = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) eventType = line.slice(7);
      else if (line.startsWith('data: ') && eventType) {
        if (eventType === 'notification') {
          handleNotification(JSON.parse(line.slice(6)));
        }
        eventType = '';
      }
    }
  }
}
```

Alternatively, pass JWT as a query parameter and use the standard `EventSource` API.

### Android (OkHttp + JWT header)

OkHttp's `EventSources` supports custom headers natively:

```kotlin
val request = Request.Builder()
  .url("$BASE_URL/v1/notifications/stream")
  .header("Authorization", "Bearer $token")
  .build()

val eventSource = EventSources.createFactory(OkHttpClient())
  .newEventSource(request, object : EventSourceListener() {
    override fun onEvent(
      eventSource: EventSource,
      id: String?, type: String?, data: String
    ) {
      when (type) {
        "notification" -> handleNotification(JSON.parseObject(data))
        "heartbeat" -> Log.d("SSE", "heartbeat")
      }
    }
  })
```

## Scaling to Multiple Instances

The in-memory `Map<string, Response[]>` works for single-process. For horizontal scaling, replace `SseConnectionManagerService` with a Redis pub/sub version:

```
                    ┌──────────────┐
                    │   Redis      │
                    │   Pub/Sub    │
                    └──────┬───────┘
                           │
            ┌──────────────┴──────────────┐
            │                              │
     ┌──────▼───────────┐        ┌────────▼──────────┐
     │  Instance A      │        │  Instance B       │
     │  subs: user_123  │        │  (no connection)  │
     │  → sends SSE     │        │  → ignores        │
     └──────────────────┘        └───────────────────┘
```

## Existing Event Listeners — Fix userId Targeting

`VerificationListener` currently sends to hardcoded `'system'`. Update to target the actual property owner:

```typescript
@OnEvent('property.verified')
async onVerified(event: PropertyVerifiedEvent): Promise<void> {
  const property = await this.prisma.property.findUnique({
    where: { id: event.propertyId },
    select: { user_id: true },
  });
  if (!property) return;

  await this.notification.send(property.user_id, {
    type: 'property.verified',
    title: 'Property Verified',
    message: `Your property has been verified successfully.`,
    metadata: { propertyId: event.propertyId },
  });
}
```

## Implementation Order

| Step | What | Files |
|------|------|-------|
| 1 | Add `Notification` model to Prisma schema, run migration | `prisma/schema.prisma` |
| 2 | Create `NotificationChannel` interface | `src/infrastructure/notification/interfaces/notification-channel.interface.ts` |
| 3 | Rename `MockNotificationService` → `LogNotificationChannel` (implements `NotificationChannel`) | `src/infrastructure/notification/services/log-notification-channel.service.ts` |
| 4 | Create `NotificationService` (orchestrator — implements `INotificationService`) | `src/infrastructure/notification/services/notification.service.ts` |
| 5 | Create `SseConnectionManagerService` | `src/infrastructure/notification/sse/sse-connection-manager.service.ts` |
| 6 | Create `SseController` with stream + CRUD endpoints | `src/infrastructure/notification/sse/sse.controller.ts` |
| 7 | Update `NotificationModule` to wire orchestrator + channels | `notification.module.ts` |
| 8 | Delete old `MockNotificationService` (replaced by `LogNotificationChannel`) | `services/mock-notification.service.ts` |
| 9 | Update event listeners to target real userIds | `verification.listener.ts` |
| 10 | Test via curl | `curl -N http://localhost:3000/v1/notifications/stream -H "Authorization: Bearer <token>"` |
| 11 | Build frontend clients | apps/web, apps/mobile |

## Adding Future Channels (Email, SMS)

Create a new class implementing `NotificationChannel` and register it in the `NOTIFICATION_CHANNELS` multi-provider:

```typescript
@Injectable()
export class EmailNotificationChannel implements NotificationChannel {
  readonly name = 'email';
  constructor(private readonly mailer: MailerService) {}

  async send(userId: string, event: NotificationEvent): Promise<void> {
    // lookup user email, send email
  }
}

// In module:
{
  provide: 'NOTIFICATION_CHANNELS',
  useFactory: (...channels: NotificationChannel[]) => channels,
  inject: [LogNotificationChannel, EmailNotificationChannel],
}
```

No changes needed to `NotificationService` — it already iterates all channels.
