# Property APIs

Base path: `/v1/properties`
Auth: All three endpoints require authentication via `@CurrentUser()` decorator. The `AuthenticatedUser` object contains `id` and `email`.

## Rate Limiting

All three endpoints have a throttle of `{ limit: 10, ttl: 60000 }` — max 10 requests per minute per client (overrides the controller-wide default of 60/min).

---

## 1. POST /v1/properties — Upsert (Create)

Create a new property or update an existing one if `property_id` is provided.

### Request Body (`UpsertPropertyDto`)

All fields are **optional** due to `@IsOptional()`. When creating, at least `area_id` is required (enforced server-side). Fields not sent are left as undefined and skip update.

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `property_id` | `string` (UUID) | No | `@IsUUID()` | Omit to create; include to update |
| `area_id` | `string` (UUID) | No (DTO) / **Yes** (create) | `@IsUUID()` | Required for creation; validated against DB |
| `title` | `string` | No | `@MaxLength(255)`, trimmed | |
| `description` | `string` | No | `@MaxLength(5000)` | |
| `type` | `string` (enum) | No | `@IsEnum(PropertyType)` | Values match Prisma `PropertyType` enum |
| `subtype` | `string` | No | — | Free-text sub-category |
| `listing_type` | `string` (enum) | No | `@IsEnum(ListingType)` | Values match Prisma `ListingType` enum |
| `price` | `number` | No | `@Min(0)` | Transformed from string via `@Type(() => Number)` |
| `price_currency` | `string` | No | `@MaxLength(3)` | e.g. `USD`, `EUR` |
| `area_size` | `number` | No | `@Min(0)`, `@Type(() => Number)` | |
| `area_unit` | `string` | No | — | e.g. `sqft`, `sqm` |
| `location_lat` | `number` | No | `@Type(() => Number)` | |
| `location_lng` | `number` | No | `@Type(() => Number)` | |
| `address` | `string` | No | `@MaxLength(500)` | |
| `amenities` | `object` | No | `@IsObject()` | `Record<string, any>`. Validated against property type |
| `virtual_tour_url` | `string` | No | `@IsUrl()` | |
| `status` | `string` (enum) | No | `@IsEnum(PropertyStatus)` | Only honored for admin users (via admin endpoint) |

### Behavior

#### Create Path (no `property_id`)
- `area_id` is **required** — throws `PROPERTY_MISSING_AREA` (400) if missing.
- The area is validated to exist — throws `AREA_NOT_FOUND` if not.
- If `type` and `amenities` are both provided, amenities are validated against the type.
- Status is **auto-computed**:
  - `pending` if all required fields present: `title`, `type`, `listing_type`, `price`.
  - `draft` otherwise (missing one or more required fields).
- Defaults: `type = 'residential'`, `listing_type = 'sale'`, `price = 0`, `title = ''`

#### Update Path (`property_id` provided)
- Property must exist — throws `PROPERTY_NOT_FOUND` (404) if not.
- Ownership check: `existing.user_id !== userId` throws `ForbiddenException` (403).
- If `area_id` provided, area must exist.
- If `amenities` provided, validated against `dto.type ?? existing.type`.
- Only sent fields are applied to the update (partial update).
- `area_id` is treated as a relation update (`area.connect`).
- Status is **re-computed** from merged existing + new data. If the computed status differs from current, it is updated.
- List cache & detail cache for this property are invalidated.

### Possible Responses

| HTTP Status | Condition |
|---|---|
| `201 Created` | Success — returns created/updated property object |
| `400 Bad Request` | Validation error, missing `area_id`, invalid amenities, area not found |
| `403 Forbidden` | User does not own the property |
| `404 Not Found` | Property or area not found |

### Response Shape (Success)

On create, shape matches `PropertyListItem`:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "area_id": "uuid",
  "title": "string",
  "description": "string|null",
  "type": "string",
  "subtype": "string|null",
  "listing_type": "string",
  "price": 0,
  "price_currency": "string",
  "area_size": "number|null",
  "area_unit": "string|null",
  "location_lat": "number|null",
  "location_lng": "number|null",
  "address": "string|null",
  "amenities": "object|null",
  "status": "string",
  "is_verified": false,
  "virtual_tour_url": "string|null",
  "view_count": 0,
  "published_at": "ISO-date|null",
  "created_at": "ISO-date",
  "updated_at": "ISO-date"
}
```

On update, returns `{ "id": "uuid" }`.

---

## 2. PATCH /v1/properties/:id — Update (Deprecated)

**Deprecated.** Use `POST /v1/properties` with `property_id` in the body instead. Kept for backward compatibility with existing clients.

Internally calls the same `propertyService.upsert()` by injecting `property_id: id` into the DTO:
```ts
propertyService.upsert({ ...dto, property_id: id }, user.id)
```

### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | Property ID |

### Request Body

Same as `UpsertPropertyDto` above.

### Behavior

Identical to the update path of `POST /v1/properties` — ownership check, field-level partial update, status re-computation, cache invalidation.

### Possible Responses

| HTTP Status | Condition |
|---|---|
| `200 OK` | Success |
| `400 Bad Request` | Validation error, area not found, invalid amenities |
| `403 Forbidden` | User does not own the property |
| `404 Not Found` | Property not found |

### Response Shape (Success)

```json
{ "id": "uuid" }
```

---

## 3. POST /v1/properties/:id/submit — Submit for Verification

Submit a draft property with status `pending` for admin verification.

### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | Property ID |

### Request Body

**None.** The endpoint takes no body.

### Behavior

1. Property must exist — throws `PROPERTY_NOT_FOUND` (404).
2. Ownership check — `property.user_id !== userId` throws `ForbiddenException` (403).
3. Status must be `pending` — throws `PROPERTY_CANNOT_SUBMIT` (400) if not.
4. All required fields are validated:
   - `title`, `description`, `type`, `listing_type`, `price` (> 0), `area_id`, `area_size` (> 0), `area_unit`, `address`, `location_lat`, `location_lng`
   - At least 1 media item must exist.
   - If any missing, throws `PROPERTY_CANNOT_SUBMIT` (400) with the list of missing fields.
5. A `Verification` record is created via `createVerification()`.
6. A background task is enqueued (`backgroundTaskService.enqueueVerification`) for async verification processing.
7. Cache is invalidated for list + detail.

### Possible Responses

| HTTP Status | Condition |
|---|---|
| `202 Accepted` | Successfully submitted for verification |
| `400 Bad Request` | Status is not `pending`, or missing required fields |
| `403 Forbidden` | User does not own the property |
| `404 Not Found` | Property not found |

### Response Shape (Success)

```json
{
  "id": "uuid",
  "status": "pending"
}
```

---

## Error Codes

All errors are thrown as `AppException` or `ForbiddenException` and returned in a standard error format:

```json
{
  "statusCode": 400,
  "error": {
    "code": 1521,
    "message": "Only draft properties can be submitted for review"
  }
}
```

| Error Code | Message | HTTP Status | Thrown By |
|---|---|---|---|
| 1500 | Property not found | 404 | All three endpoints |
| 1501 | You do not have permission to modify this property | 403 | Not used directly; uses generic 403 |
| 1502 | area_id is required for property creation | 400 | `POST /` (create path) |
| 1503 | Invalid amenities structure for the specified property type | 400 | `POST /`, `PATCH /:id` |
| 1521 | Only draft properties can be submitted for review | 400 | `POST /:id/submit` |

---

## Authentication

All three endpoints require the request to have a valid JWT token. The `@CurrentUser()` parameter decorator extracts `{ id, email }` from the authenticated request.

On the controller class, the following routes are **public** (no auth):
- `GET /v1/properties` — list published properties
- `GET /v1/properties/:id` — get single published property

All other routes (including these three) require authentication.
