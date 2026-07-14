# API Endpoint Caching

This document outlines how caching is implemented for API endpoints within the Homenet API to optimize performance and reduce database load.

## Implementation Overview

Caching in this project is implemented programmatically in the service layer using a centralized `CacheService` (`src/common/cache/cache.service.ts`), which wraps the standard `@nestjs/cache-manager`.

Instead of relying on global interceptors, caching is handled manually in the respective services using the `getOrSet` pattern. This provides fine-grained control over cache keys, TTL (Time-To-Live), and invalidation.

## What is Cached?

Currently, caching is primarily applied to read-heavy endpoints that are requested frequently and change infrequently. The main entities cached are **Properties** and **Areas**.

### 1. Properties
*   **Lists / Search Results:** Caches the results of querying properties.
    *   **Cache Key Pattern:** `properties:list:{serialized_query_params}`
    *   **Invalidation:** The list cache (`properties:list:all`) is invalidated whenever a property is created, updated, or deleted.
*   **Property Details:** Caches the details of a single property.
    *   **Cache Key Pattern:** `properties:detail:{property_id}`
    *   **Invalidation:** The detail cache is invalidated when that specific property is updated, deleted, or has media added/removed.

### 2. Areas
*   **List of Areas:** Caches the full list or search results of areas.
    *   **Cache Key Pattern:** `areas:list`
    *   **Invalidation:** Invalidated when an area is created, updated, or deleted.
*   **Area Details:** Caches a single area.
    *   **Cache Key Pattern:** `areas:detail:{area_id}`
    *   **Invalidation:** Invalidated when that specific area is updated or deleted.
*   **Area Children:** Caches the hierarchical children of an area.
    *   **Cache Key Pattern:** `areas:children:{area_id}`

## Time-To-Live (TTL)

The default TTLs are defined as constants in `src/common/cache/cache.service.interface.ts`.

*   **Lists (`CACHE_TTL.LIST`):** `300,000 ms` (5 minutes)
*   **Details (`CACHE_TTL.DETAIL`):** `600,000 ms` (10 minutes)

## Cache Invalidation Strategy

Cache invalidation is handled explicitly within the mutation methods (`create`, `update`, `delete`, `remove`, `addMedia`, etc.) of the respective services. 

When a mutation occurs, the service calls `this.cacheService.del(key)` or `this.cacheService.delMany(keys[])` to ensure the next read fetches fresh data from the database.

## Example: The `getOrSet` Pattern

The typical read operation looks like this:

```typescript
async findOne(id: string) {
  const cacheKey = `properties:detail:${id}`;

  return this.cacheService.getOrSet(cacheKey, async () => {
    // This code only runs on a Cache Miss
    const property = await this.propertyRepo.findPublishedById(id);
    if (!property) throw new AppException(PROPERTY_ERRORS.PROPERTY_NOT_FOUND);
    return property;
  }, CACHE_TTL.DETAIL);
}
```

## Module-wise Endpoint Caching Table

Below is a comprehensive breakdown of the API endpoints, specifying whether they are cached, the cache keys used, the Time-To-Live (TTL), and when the cache is invalidated.

### Area Module

| Endpoint | Method | Cached? | Cache Key Pattern | TTL | Invalidation Triggers |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/area` | GET | Yes | `areas:list` | 5 min | POST, PATCH, DELETE operations on any area |
| `/area/:id` | GET | Yes | `areas:detail:{id}` | 10 min | PATCH, DELETE operations on this specific area |
| `/area/:id/children` | GET | Yes | `areas:children:{id}` | 5 min | POST, PATCH, DELETE operations |
| `/area` | POST | No | N/A | N/A | Invalidates `areas:list` |
| `/area/:id` | PATCH | No | N/A | N/A | Invalidates `areas:list`, `areas:detail:{id}` |
| `/area/:id` | DELETE | No | N/A | N/A | Invalidates `areas:list`, `areas:detail:{id}` |

### Property Module

| Endpoint | Method | Cached? | Cache Key Pattern | TTL | Invalidation Triggers |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/property` | GET | Yes | `properties:list:{params}` | 5 min | POST, PATCH, DELETE operations on properties |
| `/property/admin` | GET | No | N/A | N/A | Data served directly from DB |
| `/property/:id` | GET | Yes | `properties:detail:{id}` | 10 min | PATCH, DELETE, Add/Remove Media on this property |
| `/property` | POST | No | N/A | N/A | Invalidates `properties:list:all` |
| `/property/:id` | PATCH | No | N/A | N/A | Invalidates `properties:list:all`, `properties:detail:{id}` |
| `/property/:id` | DELETE | No | N/A | N/A | Invalidates `properties:list:all`, `properties:detail:{id}` |
| `/property/:id/media` | POST | No | N/A | N/A | Invalidates `properties:detail:{id}` |
| `/property/media/:id` | DELETE| No | N/A | N/A | Invalidates `properties:detail:{property_id}` |

### User Module

| Endpoint | Method | Cached? | Cache Key Pattern | TTL | Invalidation Triggers |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/user` | GET | Yes | `users:list` | 5 min | PATCH, DELETE operations on any user |
| `/user/:id` | GET | Yes | `users:profile:{id}` | 10 min | PATCH, DELETE operations on this specific user |
| `/user/:id` | PATCH | No | N/A | N/A | Invalidates `users:list`, `users:profile:{id}` |
| `/user/:id` | DELETE | No | N/A | N/A | Invalidates `users:list`, `users:profile:{id}` |

### Role Module

| Endpoint | Method | Cached? | Cache Key Pattern | TTL | Invalidation Triggers |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/role` | GET | Yes | `roles:list` | 5 min | Permission assignment/removal operations |
| `/role/:id` | GET | No | N/A | N/A | Data served directly from DB |
| `/role/user/:userId` | GET | Yes | `roles:user:{userId}` | 10 min | Assign/Revoke role operations for the user |
| `/role/assign` | POST | No | N/A | N/A | Invalidates `roles:user:{userId}`, `roles:permissions:{userId}`|
| `/role/revoke` | DELETE| No | N/A | N/A | Invalidates `roles:user:{userId}`, `roles:permissions:{userId}`|
| `/role/:id/permissions`| POST | No | N/A | N/A | Invalidates `roles:list` |
| `/role/:id/permissions/:pid`| DELETE| No | N/A | N/A | Invalidates `roles:list` |

### Auth Module

| Endpoint | Method | Cached? | Cache Key Pattern | TTL | Invalidation Triggers |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `/v1/auth/me` | GET | Yes | `auth:profile:{userId}`| 10 min | N/A (Relies on TTL) |
| `/v1/auth/register` | POST | No | N/A | N/A | N/A |
| `/v1/auth/login` | POST | No | N/A | N/A | N/A |
| `/v1/auth/refresh` | POST | No | N/A | N/A | N/A |
| `/v1/auth/logout` | POST | No | N/A | N/A | N/A |
