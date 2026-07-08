# Architecture Overview

The **Homenet API** is built with **NestJS** (v11) following the framework's modular architecture.  The entry point is `src/app.module.ts` which wires together the core building blocks.

## Core Modules

| Module | Purpose | Key Files |
|---|---|---|
| **AuthModule** | Handles user authentication, JWT issuance, login/refresh flows. | `src/modules/auth/*` |
| **UserModule** | CRUD operations for user profiles. | `src/modules/user/*` |
| **RoleModule** | Role‑based access control (RBAC) with permissions. | `src/modules/role/*` |
| **PrismaModule** | Prisma ORM integration, provides `PrismaService` for DB access. | `src/config/prisma/*` |
| **LoggerModule** | Centralised Winston logger used across the app. | `src/common/logger/*` |
| **CacheServiceModule** | Centralised caching service. | `src/common/cache/*` |
| **AreaModule** | Manages area entities and related business logic. | `src/modules/area/*` |
| **PropertyModule** | Handles property CRUD, media, and queries. | `src/modules/property/*` |
| **Global Guards** | JWT auth, permissions, and rate‑limiting are registered as `APP_GUARD`s. | `src/app.module.ts` (providers) |

## Global Providers (app.module.ts)
```ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({ /* config */ }),
    PrismaModule,
    LoggerModule,
    AuthModule,
    UserModule,
    RoleModule,
    AreaModule,
    PropertyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```
*`JwtAuthGuard` validates JWT on every request.*
*`PermissionsGuard` enforces `@Permissions` decorator checks.*
*`ThrottlerGuard` provides rate‑limiting (see `@nestjs/throttler`).*

## Data Layer – Prisma
The `prisma/schema.prisma` defines the relational schema (users, roles, permissions, etc.).  Prisma generates a type‑safe client used via `PrismaService`.

## Request/Response Pipeline
1. **Global Interceptor** – `ResponseInterceptor` formats all successful responses in a unified shape.
2. **Global Exception Filter** – `GlobalExceptionFilter` catches unhandled errors and maps them to the structured error objects defined in `src/common/errors/*`.
3. **Swagger** – API documentation is auto‑generated (`@nestjs/swagger`) and served at `/api/docs`.

## Extensibility
- Add a new domain by creating a feature module under `src/modules/` and import it in `AppModule`.
- Register additional global guards or interceptors in the `providers` array.
- Extend the Prisma schema and run `prisma migrate dev` to evolve the data model.

---
*All file references are relative to the repository root.*