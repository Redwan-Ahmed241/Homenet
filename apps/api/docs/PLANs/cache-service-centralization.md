# Cache Service Centralization Plan

**Status:** Draft
**Created:** 2026-07-08
**Scope:** `apps/api/src/`

---

## 1. Current State

Caching is scattered across modules with no centralization:

| Module | Caching? | Pattern | Issues |
|--------|----------|---------|--------|
| `area` | Yes | Direct `CACHE_MANAGER` injection in service | Duplicated get/set/del + logging logic |
| `property` | Yes | Direct `CACHE_MANAGER` injection + passes `cacheManager` to repository | Same duplication + leaky abstraction (repo depends on cache) |
| `auth` | No | — | No caching at all |
| `role` | No | — | No caching at all |
| `user` | No | — | No caching at all |

**Problems:**
- CacheModule registered independently in `area.module.ts` and `property.module.ts` (duplicate instances)
- Every get/set/del requires manual cache-key construction, TTL passing, and logging
- Cache invalidation logic is inline in service methods (create/update/delete)
- Property repository interface accepts `cacheManager: any` — repository layer shouldn't know about caching
- No standard TTL strategy — each module uses arbitrary hardcoded values
- Hard to swap from in-memory to Redis (cache-manager supports it, but no central config)

---

## 2. Goals

1. **Create `CacheService`** — a centralized injectable service wrapping `CACHE_MANAGER` with a clean interface
2. **Define `ICacheService` interface** — for testability and future swapping
3. **Standardize cache patterns** — provide helpers for cache-aside, bulk invalidation, and key generation
4. **Eliminate per-module CacheModule.register()** — register once globally in `AppModule`
5. **Keep caching in service layer** — repositories stay cache-unaware; remove `cacheManager` from property repository interface
6. **Add caching to auth/role/user** — where appropriate (read-heavy endpoints)

---

## 3. Proposed Architecture

```
apps/api/src/
├── common/
│   └── cache/                          ← NEW: cache service lives here
│       ├── cache.service.ts            ← CacheService implementation
│       ├── cache.service.interface.ts  ← ICacheService interface
│       └── cache.module.ts             ← Global module exporting CacheService
└── modules/
    ├── area/
    │   ├── area.service.ts             ← Inject CacheService instead of CACHE_MANAGER
    │   └── area.module.ts              ← Remove CacheModule.register()
    ├── property/
    │   ├── property.service.ts         ← Inject CacheService instead of CACHE_MANAGER
    │   ├── interfaces/...
    │   │   └── property-repository.interface.ts  ← Remove cacheManager param
    │   └── repositories/
    │       └── prisma-property.repository.ts     ← Remove cacheManager param
    ├── auth/
    │   ├── auth.service.ts             ← Add CacheService for profile caching (optional)
    │   └── auth.module.ts              ← No CacheModule change
    ├── role/
    │   ├── role.service.ts             ← Add CacheService for permission caching
    │   └── role.module.ts              ← No CacheModule change
    └── user/
        ├── user.service.ts             ← Add CacheService for user profile caching
        └── user.module.ts              ← No CacheModule change
```

### Dependency Flow

```
Controller → Service → CacheService (injected interface)
                       └── wraps CACHE_MANAGER from @nestjs/cache-manager

CacheModule (global)
  └── CacheModule.register()  ← moved from per-module to app.module.ts
```

---

## 4. ICacheService Interface

```typescript
export interface ICacheService {
  // Core operations
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;

  // Cache-aside pattern: check cache → hit? return : fetch → store → return
  getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>;

  // Bulk operations
  delMany(keys: string[]): Promise<void>;
  delByPattern(pattern: string): Promise<void>;  // for prefix-based invalidation

  // Key helpers
  generateKey(prefix: string, ...parts: (string | number | object)[]): string;
}
```

### Default TTLs (configurable via constructor options)

| Cache Type | Default TTL | Notes |
|-----------|------------|-------|
| List caches | 300s (5 min) | areas:list, properties:list |
| Detail caches | 600s (10 min) | areas:detail:{id}, properties:detail:{id} |
| Permission caches | 600s (10 min) | roles:permissions:{userId} |
| Profile caches | 600s (10 min) | users:profile:{id} |

---

## 5. Implementation Steps

### Phase 1: Create CacheService infrastructure

1. **Create `apps/api/src/common/cache/cache.service.interface.ts`**
   - Define `ICacheService` with methods listed above
   - Include TTL constants as a config object

2. **Create `apps/api/src/common/cache/cache.service.ts`**
   - `@Injectable()` class implementing `ICacheService`
   - Inject `CACHE_MANAGER` (only this class touches it)
   - Implement `get`, `set`, `del` with standardized logging
   - Implement `getOrSet` — the cache-aside pattern (check → hit? return → fetch → set → return)
   - Implement `delByPattern` — iterate keys matching a prefix pattern (requires store.keys() support)
   - Log all operations through `LoggerService`

3. **Create `apps/api/src/common/cache/cache.module.ts`**
   - `@Global()` module
   - Import `CacheModule.register()` (moved from per-module to here)
   - Provide `{ provide: 'ICacheService', useClass: CacheService }`
   - Export `ICacheService` token

### Phase 2: Update AppModule

1. **Update `apps/api/src/app.module.ts`**
   - Import `CacheModule` from `./common/cache/cache.module.js`
   - Remove per-module `CacheModule.register()` from area and property modules

### Phase 3: Migrate area module

1. **Update `area.service.ts`**
   - Replace `@Inject(CACHE_MANAGER) private readonly cacheManager: Cache`
     → `@Inject('ICacheService') private readonly cacheService: ICacheService`
   - Replace `this.cacheManager.get(cacheKey)` → `this.cacheService.get(cacheKey)`
   - Replace `this.cacheManager.set(cacheKey, value, ttl)` → `this.cacheService.set(cacheKey, value, ttl)`
   - Replace `this.cacheManager.del(key)` → `this.cacheService.del(key)`
   - Optionally use `getOrSet` for findAll/findOne/findChildren to simplify
   - Remove inline cache hit/miss logging (handled by CacheService)

2. **Update `area.module.ts`**
   - Remove `CacheModule.register()` from imports

### Phase 4: Migrate property module

1. **Update `property.service.ts`**
   - Same replacements as area (CACHE_MANAGER → CacheService)
   - `invalidateListCache`, `invalidateDetailCache`, `invalidateAll` → delegate to CacheService
   - Proximity search: stop passing cacheManager to repository; handle caching in service

2. **Update `property-repository.interface.ts`**
   - Remove `cacheManager: any` parameter from `findWithProximitySearch`

3. **Update `prisma-property.repository.ts`**
   - Remove `cacheManager` from method signature
   - Remove any `cacheManager.set()` calls inside the repository

4. **Update `property.module.ts`**
   - Remove `CacheModule.register()` from imports

### Phase 5: Add caching to remaining modules

1. **`user.service.ts`**
   - Cache `findOne(id)` profile lookups (TTL: 600s)
   - Invalidate on `update(id)` and `remove(id)`

2. **`role.service.ts`**
   - Cache `getUserPermissions(userId)` (TTL: 600s) — permission checks are frequent
   - Invalidate on `assignRoleToUser`, `removeRoleFromUser`
   - Cache `findAllRoles()` (TTL: 300s)

3. **`auth.service.ts`**
   - Cache `getProfile(userId)` (TTL: 600s)

### Phase 6: Cleanup & Testing

1. Remove `import { CACHE_MANAGER } from '@nestjs/cache-manager'` and `import type { Cache } from 'cache-manager'` from all service files
2. Run full test suite
3. Verify all cache keys still match (should be identical)

---

## 6. Logging Strategy

All cache-related logging moves to `CacheService`:

| Log event | Level | Fields |
|-----------|-------|--------|
| Cache hit | DEBUG | `key`, `hit: true` |
| Cache miss | DEBUG | `key`, `hit: false` |
| Cache set | TRACE | `key`, `ttl` |
| Cache del | TRACE | `key` |
| Cache error | ERROR | `key`, `operation`, `error` |

Service-level logging for cache is eliminated — services log business logic only.

---

## 7. TTL Strategy

| Prefix | Default TTL | Used by |
|--------|-------------|---------|
| `areas:list` | 300s | Area list queries |
| `areas:detail:*` | 600s | Area detail queries |
| `areas:children:*` | 300s | Area children queries |
| `properties:list:*` | 300s | Property list queries (incl. proximity) |
| `properties:detail:*` | 600s | Property detail queries |
| `properties:media:*` | 600s | Property media queries |
| `users:profile:*` | 600s | User profile lookups |
| `roles:permissions:*` | 600s | User permission checks |
| `roles:list` | 300s | Role list queries |

TTLs should be defined as constants in `cache.service.ts` and overridable per-call.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `delByPattern` needs store.keys() — not all cache stores support it | Fall back to known key patterns; maintain a key registry or iterate manually |
| Property repository currently owns cache writes for proximity search | Move proximity caching to service layer; repo returns data, service caches it |
| Cache key breakage during migration | Keep exact same key strings — only the wrapper changes |
| Per-module CacheModule.register() creates separate cache instances | Switching to single global CacheModule ensures one cache store |
| Breaking changes to property repository interface | Update interface + all callers in same commit |

---

## 9. Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: CacheService infra | 1 day | None |
| Phase 2: AppModule | 0.25 day | Phase 1 |
| Phase 3: Area migration | 0.5 day | Phase 1 |
| Phase 4: Property migration | 0.5 day | Phase 1 |
| Phase 5: Auth/Role/User caching | 1 day | Phase 1 |
| Phase 6: Cleanup & tests | 0.5 day | All above |
| **Total** | **~3.75 days** | |

---

## 10. File Manifest

### New files
```
apps/api/src/common/cache/
├── cache.service.interface.ts
├── cache.service.ts
└── cache.module.ts
```

### Modified files
```
apps/api/src/app.module.ts                          ← Import CacheModule globally
apps/api/src/modules/area/area.service.ts           ← Inject CacheService
apps/api/src/modules/area/area.module.ts            ← Remove CacheModule.register()
apps/api/src/modules/property/property.service.ts   ← Inject CacheService
apps/api/src/modules/property/property.module.ts    ← Remove CacheModule.register()
apps/api/src/modules/property/interfaces/property-repository.interface.ts  ← Remove cacheManager param
apps/api/src/modules/property/repositories/prisma-property.repository.ts   ← Remove cacheManager logic
apps/api/src/modules/auth/auth.service.ts           ← Inject CacheService (optional)
apps/api/src/modules/user/user.service.ts           ← Inject CacheService
apps/api/src/modules/role/role.service.ts           ← Inject CacheService
```
