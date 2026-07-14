# Repository Pattern Refactoring Plan

**Status:** Draft  
**Created:** 2026-07-08  
**Scope:** `apps/api/src/modules/*`

---

## 1. Current State

All 5 modules (`area`, `auth`, `property`, `role`, `user`) inject `PrismaService` directly into their service files. Every DB operation — CRUD, raw SQL, transactions — lives inline in services. There is **zero data-access abstraction**. Logging and error handling for DB operations are also done in services.

**Files impacted:**
| Module | Service | Lines | Complexity |
|---|---|---|---|
| `area` | `area.service.ts` | ~371 | High — raw PostGIS SQL, caching |
| `auth` | `auth.service.ts` | ~400+ | High — transactions, refresh rotation |
| `property` | `property.service.ts` | ~500+ | High — caching, proximity search |
| `role` | `role.service.ts` | ~250 | Medium — flat CRUD + permission aggregation |
| `user` | `user.service.ts` | ~181 | Low — simple CRUD |

---

## 2. Goals

1. **Separate DB concerns** — move all Prisma calls (queries, raw SQL, transactions) into per-module repositories.
2. **Centralize DB logging** — DB-level logs (query timing, row counts, errors) live in repositories, not services.
3. **Improve testability** — services can be unit-tested by mocking repositories instead of mocking Prisma.
4. **Enforce consistency** — common error handling for Prisma exceptions (e.g., `P2002` → unique constraint) in one place.
5. **Minimal service disruption** — service method signatures stay the same; only the internals change.

---

## 3. Proposed Architecture

```
src/modules/<module>/
  ├── <module>.module.ts                ← registers Repository impl
  ├── <module>.controller.ts            ← unchanged
  ├── <module>.service.ts               ← injects I<Module>Repository, not PrismaService
  ├── interfaces/
  │   └── <module>-repository.interface.ts  ← interface (e.g. IUserRepository)
  └── repositories/
      └── prisma-<module>.repository.ts     ← Prisma implementation (e.g. PrismaUserRepository)
```

### Per-Module Contract (Interface + Impl)

Each module defines:
- An **interface** (`IUserRepository`) — the contract the service depends on
- A **Prisma implementation** (`PrismaUserRepository`) — the only place Prisma is imported

No base repository class. No generic CRUD wrapper. Each repo is standalone and owns only the queries its module needs.

### Shared Utility (not a base class)

A single `PrismaErrorHandler` function at `src/common/database/prisma-error-handler.ts`:
- Maps `PrismaClientKnownRequestError` codes → `AppException`
- Plain import, no inheritance, no NestJS provider registration required
- Each repo calls it when catching Prisma errors

### Dependency Flow

```
Controller → Service → I<Module>Repository (injected interface)
                           ↓
                  Prisma<Module>Repository (concrete impl)
                           ↓
                   PrismaService (injected via constructor)
```

---

## 4. Implementation Steps

### Phase 1: Shared Utility (0.5 day)

1. **Create `src/common/database/prisma-error-handler.ts`**
   - A plain exported function: `handlePrismaError(modelName: string, error: unknown): never`
   - Maps known Prisma error codes to `AppException`:
     - `P2002` (unique) → `AppException` with domain-appropriate code
     - `P2025` (not found) → `AppException` with `NOT_FOUND`
     - `P2003` (FK violation) → `AppException` with `INVALID_REFERENCE`
     - Default → rethrow original
   - Not a class, not injectable. Each repository imports it directly.

2. **Inject `LoggerService` in every repository** — each Prisma repository receives `LoggerService` via constructor. DB-level logs (query start, duration, row count, errors) use the same logger format as the rest of the app. No Prisma built-in logging.

### Phase 2: Per-Module Repositories (3-5 days)

Each module follows the same pattern (interface + Prisma impl). Order by complexity (easiest first):

#### Module A: `user` (low complexity, no caching, no transactions)

1. Create `interfaces/user-repository.interface.ts`
   - Define `IUserRepository` with methods: `findById`, `findByEmail`, `findMany`, `update`, `delete`
2. Create `repositories/prisma-user.repository.ts`
   - Implement `IUserRepository`
   - Constructor-inject `PrismaService` and `LoggerService`
   - All Prisma queries here, with DB-level logging and `handlePrismaError()` on failures
3. Update `user.service.ts`
   - Inject `IUserRepository` instead of `PrismaService`
   - Replace `this.prisma` → `this.userRepo`
   - Remove DB-level logging, keep business-logic logging
4. Update `user.module.ts`
   - Add `{ provide: 'IUserRepository', useClass: PrismaUserRepository }` to `providers`

#### Module B: `role` (medium complexity, permission aggregation)

1. Create `interfaces/role-repository.interface.ts` — define `IRoleRepository`
2. Create `repositories/prisma-role.repository.ts` — implement `IRoleRepository`
   - Custom methods: `findUserRoles(userId)`, `assignRole(userId, roleId)`, `removeRole(userId)`, `getPermissions(userId)`
   - Permission aggregation logic (`flatMap` + `Set` dedup) moves here
3. Update `role.service.ts` — slim down, delegate DB to repo
4. Update `role.module.ts` — register `PrismaRoleRepository` as provider for `IRoleRepository`

#### Module C: `property` (higher complexity, caching, proximity search)

1. Create `interfaces/property-repository.interface.ts` — define `IPropertyRepository`
2. Create `repositories/prisma-property.repository.ts` — implement `IPropertyRepository`
   - Custom methods: `findWithFilters(filters, pagination)`, `searchNearby(lat, lng, radius)`, `createMedia()`, `deleteMedia()`
   - Proximity search (Haversine formula) moves here
3. **Caching stays in service** — cache key generation, invalidation, TTL are service concerns
4. Update `property.service.ts` — inject `IPropertyRepository`, keep cache logic
5. Update `property.module.ts`

#### Module D: `area` (high complexity, raw PostGIS SQL)

1. Create `interfaces/area-repository.interface.ts` — define `IAreaRepository`
2. Create `repositories/prisma-area.repository.ts` — implement `IAreaRepository`
   - Custom method: `updateGeometry(id, boundary, centroid)` — wraps `$executeRawUnsafe`
   - Method: `getChildren(id)` for hierarchical queries
3. Raw SQL stays in repository — repository is the right layer for this
4. Caching stays in service
5. Update `area.service.ts` and `area.module.ts`

#### Module E: `auth` (highest complexity, transactions, bcrypt)

1. Create `interfaces/auth-repository.interface.ts` — define `IAuthRepository`
2. Create `repositories/prisma-auth.repository.ts` — implement `IAuthRepository`
   - Methods: `findIdentityByEmail(email)`, `findRefreshToken(token)`, `rotateRefreshToken(oldId, newData)`, `createUserWithIdentity(dto)` — the last uses `$transaction`
3. **Transaction handling:** The transaction spans `user.create` + `authIdentity.create`. Expose a `createUserWithIdentity(dto)` method on the repo that runs the transaction internally. The repo handles atomicity, the service just calls `await this.authRepo.createUserWithIdentity(dto)`.
4. Token hashing (`hashToken`) — crypto utility, stays in service or moves to shared util
5. `bcrypt` operations — **not DB operations**, stay in service
6. Update `auth.service.ts` and `auth.module.ts`

### Phase 3: Cleanup & Testing

1. Remove any leftover DB-related logging from services
2. Remove direct `PrismaService` injection from all services
3. Write unit tests for repositories (mock `PrismaService`)
4. Run full integration test suite to verify behavior is unchanged
5. Update `AGENTS.md` if applicable

---

## 5. Transaction Handling Strategy

| Scenario | Current location | Strategy in repo |
|---|---|---|
| Auth: `user.create` + `authIdentity.create` | `$transaction` in `auth.service.ts` | Wrap in `AuthRepository.createUserWithIdentity(dto)` |
| Auth: refresh token rotation | `$transaction` in `auth.service.ts` | Wrap in `AuthRepository.rotateRefreshToken(oldToken, newToken)` |
| Area: geometry update via raw SQL | Called separately in `area.service.ts` | Move raw SQL into `AreaRepository.updateGeometry()` (not wrapped in transaction currently — keep as-is unless needed) |
| Future: cross-model transactions | N/A | Accept optional `Prisma.TransactionClient` in repo methods via an overload or context pattern |

---

## 6. Logging Strategy

**Current pattern** in services:
```ts
this.logger.info('message', { fileName: __filename, functionName: 'method', lineNumber: 10 });
```

**New pattern** — repositories log their own DB activity:

| Log event | Level | Fields |
|---|---|---|
| Query start | TRACE | `operation`, `model`, `params` |
| Query success | TRACE | `operation`, `model`, `duration_ms`, `rows_affected` |
| Query failure | ERROR | `operation`, `model`, `error_code`, `duration_ms` |
| Prisma known error | WARN | `operation`, `model`, `prisma_code` (e.g. P2002) |

Repositories accept `LoggerService` via constructor (or use `PrismaService`'s built-in logging).

**Recommendation:** Leverage Prisma's built-in event system for uniformity:
```ts
prisma.$on('query', (e) => logger.trace(`Query: ${e.query}`, { duration: e.duration }));
```

But keep explicit logging in custom repo methods for business-context-rich messages.

---

## 7. Error Handling Strategy

| Prisma Error | Mapped To |
|---|---|
| `P2002` (unique constraint) | `AppException` with appropriate error code |
| `P2025` (not found) | `AppException` with `NOT_FOUND` |
| `P2003` (foreign key) | `AppException` with `INVALID_REFERENCE` |
| Unexpected | Let propagate to `GlobalExceptionFilter` |

A shared `handlePrismaError(modelName, error)` utility function provides the default mapping. Each repository calls it in a catch block. Domain-specific overrides are handled by catching the `AppException` and re-throwing a more specific one if needed.

---

## 8. Migration Strategy

**Incremental, module-by-module** (not a big-bang refactor):

1. Start with `user` (simplest, lowest risk) — prove the pattern
2. Move to `role` (medium)
3. `property` and `area` in parallel (they're independent)
4. `auth` last (highest risk, most complex)

Each module gets its own PR/branch. Services continue to work during the transition because the entire change is internal to the module.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Transactions span multiple models (auth) | Repositories expose explicit transactional methods; `BaseRepository` provides a `withTransaction(tx)` or accepts `Prisma.TransactionClient` |
| Raw SQL in area module | Move 1:1 into `AreaRepository` — no abstraction needed, just relocation |
| Circular dependencies | No risk — repository imports `PrismaService`, service imports repository, controller imports service — unidirectional |
| Cache invalidation tied to DB writes | Service still owns cache logic; it calls repo methods then invalidates caches |
| Interface proliferation | Keep interfaces tightly scoped to what the service needs — no unnecessary methods. Update interface when a new query is added |
| Team learning curve | Start with `user` module as reference implementation |

---

## 10. Estimated Effort

| Phase | Effort | Dependencies |
|---|---|---|
| Phase 1: PrismaErrorHandler utility | 0.5 day | None |
| Phase 2A: `user` repository | 0.5 day | Phase 1 |
| Phase 2B: `role` repository | 0.5 day | Phase 1 |
| Phase 2C: `property` repository | 1 day | Phase 1 |
| Phase 2D: `area` repository | 1 day | Phase 1 |
| Phase 2E: `auth` repository | 1.5 days | Phase 1 |
| Phase 3: Cleanup & tests | 1-2 days | All phases 2A-2E |
| **Total** | **~6-9 days** | |

---

## 11. File Manifest (New Files)

```
src/common/database/
  └── prisma-error-handler.ts          ← shared utility function

src/modules/user/
  ├── interfaces/user-repository.interface.ts
  └── repositories/prisma-user.repository.ts

src/modules/role/
  ├── interfaces/role-repository.interface.ts
  └── repositories/prisma-role.repository.ts

src/modules/property/
  ├── interfaces/property-repository.interface.ts
  └── repositories/prisma-property.repository.ts

src/modules/area/
  ├── interfaces/area-repository.interface.ts
  └── repositories/prisma-area.repository.ts

src/modules/auth/
  ├── interfaces/auth-repository.interface.ts
  └── repositories/prisma-auth.repository.ts
```

**Modified files** (all 5 services + all 5 modules):
- Remove `PrismaService` injection, inject repository instead
- Replace `this.prisma.*` calls with `this.repository.*`
- Remove DB-level logging, keep business-logic logging
- Update `*.module.ts` to add repository to `providers`
