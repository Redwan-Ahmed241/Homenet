# Homenet API — Agent Context

## Stack
- **Runtime**: Node 20+, NestJS 11, TypeScript with ESM (`.js` extensions in imports)
- **Database**: PostgreSQL + Prisma ORM with `PrismaService` (`src/config/prisma/prisma.service.ts`, global module, injectable anywhere)
- **Auth**: JWT via `passport-jwt` — global `JwtAuthGuard` on all routes, skip with `@Public()`
- **Validation**: `class-validator` + `class-transformer` via global `ValidationPipe` (whitelist, transform, forbidNonWhitelisted)
- **Logging**: Winston via global `LoggerService` — always pass `{ fileName, functionName, lineNumber }`
- **Caching**: Global `CacheServiceModule` → `ICacheService` with `getOrSet(key, factory, ttl)` pattern
- **Events**: `@nestjs/event-emitter` for decoupled domain events
- **Config**: `@nestjs/config` with `.env` file (global module)
- **Rate limiting**: `@nestjs/throttler` — global `ThrottlerGuard`
- **Swagger**: `@nestjs/swagger` at `GET /api/docs`
- **Error handling**: `AppException` + `ErrorDefinition` (code, message, httpStatus) → `GlobalExceptionFilter`
- **Response format**: `ResponseInterceptor` wraps all responses as `{ success: boolean, message: string, data: T | null }`

## Module Structure

### Root (`app.module.ts`)
```
Global providers (APP_GUARD):
  - JwtAuthGuard       (all routes authenticated by default)
  - PermissionsGuard   (checks @Permissions() decorator)
  - ThrottlerGuard     (rate limiting)

Imports order:
  1. EventEmitterModule.forRoot()
  2. BackgroundTaskModule        — setTimeout-based verification queue
  3. NotificationModule           — INotificationService (currently logs only)
  4. EventsModule                 — domain event listeners (verification)
  5. ConfigModule.forRoot({ isGlobal: true })
  6. ThrottlerModule.forRootAsync(...)
  7. PrismaModule         (global) — PrismaService
  8. LoggerModule         (global) — LoggerService
  9. CacheServiceModule   (global) — ICacheService
  10. UploadModule                  — Cloudinary uploads
  11. AuthModule                    — login, register, refresh
  12. UserModule                    — user CRUD + avatar
  13. RoleModule                    — RBAC
  14. AreaModule                    — area hierarchy
  15. PropertyModule                — property CRUD + media
  16. VerificationModule            — property verification flow
```

### Feature modules (`src/modules/`)
```
auth/         — AuthModule     (login, register, refresh, me, change-password)
user/         — UserModule     (CRUD, avatar upload)
role/         — RoleModule     (roles, permissions, assign/revoke)
area/         — AreaModule     (area hierarchy, public read)
property/     — PropertyModule (full CRUD, media, verification submission)
verification/ — VerificationModule (process verification, emits domain events)
  events/     — PropertyVerifiedEvent, PropertyRejectedEvent
```

### Config (`src/config/`)
```
prisma/         — PrismaService, PrismaModule (global)
```

### Infrastructure (`src/infrastructure/`)
```
background-task/  — IBackgroundTaskService (PrototypeBackgroundTaskService using setTimeout)
notification/    — INotificationService (MockNotificationService - logs only)
events/          — EventsModule (VerificationListener — catches domain events, sends notifications)
```

### Common (`src/common/`)
```
cache/          — CacheServiceModule, ICacheService, CacheService (getOrSet pattern)
logger/         — LoggerService (global, Winston with 6 levels FATAL→TRACE)
decorators/     — @Public(), @Permissions(...), @CurrentUser()
guards/         — JwtAuthGuard (AuthGuard('jwt') with @Public() bypass)
filters/        — GlobalExceptionFilter
interceptors/   — ResponseInterceptor (wraps { success, message, data })
response/       — ApiResponse interface
upload/         — Cloudinary upload module
errors/         — AppException, ErrorDefinition, error codes per domain
```

## DI Conventions

String-based tokens consistently — never use class tokens:

```typescript
// Register
providers: [
  { provide: 'IUserRepository', useClass: PrismaUserRepository },
  { provide: NOTIFICATION_SERVICE, useClass: MockNotificationService },
]

// Inject
constructor(
  @Inject('IUserRepository') private readonly userRepo: IUserRepository,
) {}
```

### All existing tokens

| Token | Implementation | Module |
|---|---|---|
| `'IUserRepository'` | `PrismaUserRepository` | `UserModule` |
| `'IUploadService'` | `UploadService` | `UploadModule` |
| `'IAuthRepository'` | `PrismaAuthRepository` | `AuthModule` |
| `'IRoleRepository'` | `PrismaRoleRepository` | `RoleModule` |
| `'IAreaRepository'` | `PrismaAreaRepository` | `AreaModule` |
| `'IPropertyRepository'` | `PrismaPropertyRepository` | `PropertyModule` |
| `'ICacheService'` | `CacheService` | `CacheServiceModule` (global) |
| `NOTIFICATION_SERVICE` | `MockNotificationService` | `NotificationModule` |
| `BACKGROUND_TASK_SERVICE` | `PrototypeBackgroundTaskService` | `BackgroundTaskModule` |
| `VERIFICATION_SERVICE` | `MockVerificationService` | `VerificationModule` |
| `CLOUDINARY_TOKEN` | Cloudinary v2 instance | `UploadModule` |

### Global modules (inject anywhere, no import needed)
- `PrismaModule` → `PrismaService`
- `LoggerModule` → `LoggerService`
- `CacheServiceModule` → `ICacheService`

## Auth Flow
```
POST /v1/auth/login  (LocalAuthGuard, @Public())
  → validates email + password against AuthIdentity
  → returns { access_token, refresh_token }

Global JwtAuthGuard (AuthGuard('jwt'))
  → Reads Authorization: Bearer <token>
  → JwtStrategy.validate(payload) returns { id: payload.sub, email: payload.email }
  → Attached to req.user

Skip with @Public() decorator on handler or controller
```

### Refresh flow
```
POST /v1/auth/refresh  (@Public())
  → body: { refresh_token }
  → validates token_hash against RefreshToken table
  → issues new access_token + refresh_token pair

POST /v1/auth/logout
  → body: { refresh_token }
  → revokes the refresh token
```

## Domain Events

Events are dispatched via `@nestjs/event-emitter` (EventEmitter2):

```typescript
// Dispatch
this.eventEmitter.emit('property.verified', new PropertyVerifiedEvent(propertyId, userId, verifiedAt));

// Listen
@OnEvent('property.verified')
async onVerified(event: PropertyVerifiedEvent): Promise<void> {
  await this.notificationService.send(event.userId, { ... });
}
```

### Existing events
| Event | Fields | Emitted by |
|---|---|---|
| `property.verified` | `propertyId, userId, verifiedAt` | `VerificationService.processVerification()` |
| `property.rejected` | `propertyId, userId, notes` | `VerificationService.processVerification()` |

## Notification System
```
Domain Event → VerificationListener
                → @Inject(NOTIFICATION_SERVICE)
                  → MockNotificationService.send() — logs via Winston only
```

`INotificationService` interface:
```typescript
interface NotificationEvent {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface INotificationService {
  send(userId: string, event: NotificationEvent): Promise<void>;
}
```

Current implementation (`MockNotificationService`) just logs — no persistence, no SSE, no push.

## API Conventions
- All resource routes under `/{version}/{resource}` — e.g. `/v1/users`, `/v1/properties`
- Public routes use `@Public()` decorator
- Admin-only routes use `@Permissions('permission.name')` + `PermissionsGuard`
- Success response: `{ success: true, message: "...", data: ... }`
- Error response: `{ success: false, message: "...", error_code: "..." }`
- Controllers are thin — delegate to services, use DTOs for validation

## Endpoints

### Auth (`/v1/auth`)
| Method | Path | Auth |
|---|---|---|
| POST | `/register` | Public |
| POST | `/login` | Public |
| POST | `/refresh` | Public |
| POST | `/logout` | JWT |
| GET | `/me` | JWT |
| PATCH | `/change-password` | JWT |

### Users (`/v1/users`)
| Method | Path | Auth |
|---|---|---|
| GET | `/` | JWT |
| POST | `/avatar` | JWT |
| DELETE | `/avatar` | JWT |
| GET | `/:id` | JWT |
| PATCH | `/:id` | JWT |
| DELETE | `/:id` | JWT |

### Roles (`/v1/roles`)
| Method | Path | Auth |
|---|---|---|
| GET | `/` | JWT |
| GET | `/:id` | JWT |
| GET | `/user/:userId` | JWT |
| POST | `/assign` | JWT+Admin |
| DELETE | `/revoke` | JWT+Admin |
| POST | `/:roleId/permissions` | JWT+Admin |
| DELETE | `/:roleId/permissions/:permissionId` | JWT+Admin |

### Areas (`/v1/areas`)
| Method | Path | Auth |
|---|---|---|
| GET | `/` | Public |
| GET | `/:id` | Public |
| GET | `/:id/children` | Public |
| POST | `/` | JWT+Admin |
| PATCH | `/:id` | JWT+Admin |
| DELETE | `/:id` | JWT+Admin |

### Properties (`/v1/properties`)
| Method | Path | Auth |
|---|---|---|
| GET | `/` | Public |
| GET | `/admin` | JWT+Admin |
| GET | `/my` | JWT |
| GET | `/:id` | Public |
| POST | `/` | JWT |
| PATCH | `/:id` | JWT |
| POST | `/:id/submit` | JWT |
| DELETE | `/:id` | JWT (soft delete) |
| POST | `/:id/media` | JWT |
| DELETE | `/media/:mediaId` | JWT |
| PATCH | `/:id/admin` | JWT+Admin |
| DELETE | `/:id/admin` | JWT+Admin (hard delete) |

## Background Task System

```
PropertyService.submitForVerification(propertyId)
  → @Inject(BACKGROUND_TASK_SERVICE)
    → PrototypeBackgroundTaskService.enqueueVerification(propertyId)
      → setTimeout(() => verificationService.processVerification(propertyId), delayMs)
        → VerificationService.processVerification()
          → verificationProvider.verify(propertyId)
          → propertyService.updateVerificationStatus(...)
          → eventEmitter.emit('property.verified' | 'property.rejected')
```

Current limitation: `setTimeout`-based (not persistent). Scheduled for replacement with a proper queue (BullMQ etc.).

## Error Handling

```typescript
// Define
export const PROPERTY_ERRORS = {
  PROPERTY_NOT_FOUND: {
    code: 'PROPERTY_NOT_FOUND',
    message: 'Property not found',
    httpStatus: HttpStatus.NOT_FOUND,
  },
} satisfies Record<string, ErrorDefinition>;

// Throw
throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);

// Catch — GlobalExceptionFilter
// Returns { success: false, message: "...", error_code: "..." }
```

## Logging Pattern

Every log call must include `fileName`, `functionName`, `lineNumber`:

```typescript
this.logger.info('User created', {
  fileName: 'user.service.ts',
  functionName: 'createUser',
  lineNumber: 42,
});
```

Six levels: `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE`.
Output: `logs/error.log` (ERROR+), `logs/app.log` (all levels), console in dev.

## Caching Pattern

```typescript
return this.cacheService.getOrSet(cacheKey, async () => {
  // expensive operation
  return result;
}, ttlInSeconds);
```

## Verification Flow (end-to-end)

1. User submits property: `POST /v1/properties/:id/submit` → `PropertyService.submitForVerification()`
2. Property status set to `pending`, Verification record created
3. `BackgroundTaskService.enqueueVerification(propertyId)` — scheduled with `setTimeout`
4. After delay, `VerificationService.processVerification(propertyId)` runs
5. `MockVerificationService.verify()` — simulates AI verification (always approves with mock)
6. `PropertyService.updateVerificationStatus()` — updates property + verification records
7. `EventEmitter2` emits domain event with `propertyId` and `userId`
8. `VerificationListener` catches event → `INotificationService.send(userId, event)`

## Commands
```bash
npm run start:dev          # watch mode (installs, migrates, starts)
npm run build
npm run test               # unit tests
npm run test:e2e           # e2e tests
npm run lint               # ESLint
npx prisma migrate dev --name <desc>
npx prisma generate
npm run seed:areas
npm run seed:roles
npm run seed:properties
```
