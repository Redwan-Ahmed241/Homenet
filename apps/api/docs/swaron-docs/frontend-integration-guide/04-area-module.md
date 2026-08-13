# Area Module — Frontend Integration Guide

> **Base URL:** `http://localhost:3000/v1/areas`
>
> **CORS:** Allowed origins — `localhost:3000` through `localhost:3006`, and `localhost:5173` through `localhost:5176` (Vite dev servers).
>
> **Global Response Format (Success):**
> ```json
> {
>   "success": true,
>   "message": "OK",
>   "data": { ... }
> }
> ```
>
> **Global Response Format (Error):**
> ```json
> {
>   "success": false,
>   "message": "Error description",
>   "error_code": 1400,
>   "data": null
> }
> ```
>
> **Auth:** Public read endpoints (GET) require NO auth. Admin endpoints (POST, PATCH, DELETE) require `manage_areas` permission.

---

## 1. GET /v1/areas

> **Public** — No auth required.

List all areas with pagination and filtering. Uses caching (60s TTL).

### Query Parameters

| Parameter        | Type   | Required | Description                                          |
|------------------|--------|----------|------------------------------------------------------|
| `city`           | string | No       | Filter by city name                                  |
| `parent_area_id` | string | No       | Filter by parent area UUID                           |
| `search`         | string | No       | Search by area name (case-insensitive, contains)     |
| `page`           | number | No       | Page number (default: 1, min: 1)                     |
| `limit`          | number | No       | Items per page (default: 20, min: 1, max: 100)       |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns paginated areas

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid-of-area-1",
        "name": "Gulshan",
        "parent_area_id": "uuid-of-parent",
        "city": "Dhaka",
        "created_at": "2026-07-28T10:00:00.000Z",
        "updated_at": "2026-07-28T10:00:00.000Z",
        "_count": {
          "children": 3
        }
      },
      {
        "id": "uuid-of-area-2",
        "name": "Banani",
        "parent_area_id": "uuid-of-parent",
        "city": "Dhaka",
        "created_at": "2026-07-28T10:00:00.000Z",
        "updated_at": "2026-07-28T10:00:00.000Z",
        "_count": {
          "children": 0
        }
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 20,
    "total_pages": 2
  }
}
```

#### ✅ 200 OK — Empty results (no matching areas)

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "limit": 20,
    "total_pages": 0
  }
}
```

---

## 2. GET /v1/areas/:id

> **Public** — No auth required.

Get a single area by its UUID with parent and children details. Uses caching (60s TTL).

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the area to fetch |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns area details

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-area",
    "name": "Gulshan",
    "parent_area_id": "uuid-of-parent-city",
    "city": "Dhaka",
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T10:00:00.000Z",
    "parent": {
      "id": "uuid-of-parent-city",
      "name": "Dhaka City"
    },
    "children": [
      {
        "id": "uuid-of-sub-area-1",
        "name": "Gulshan 1"
      },
      {
        "id": "uuid-of-sub-area-2",
        "name": "Gulshan 2"
      }
    ]
  }
}
```

#### ✅ 200 OK — Area with no parent (root area)

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-area",
    "name": "Dhaka City",
    "parent_area_id": null,
    "city": "Dhaka",
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T10:00:00.000Z",
    "parent": null,
    "children": [
      {
        "id": "uuid-of-sub-area",
        "name": "Gulshan"
      }
    ]
  }
}
```

#### ❌ 404 Not Found — Area not found

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

---

## 3. GET /v1/areas/:id/children

> **Public** — No auth required.

Get all direct children of a specific area. Uses caching (60s TTL).

### Parameters

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `id`      | string | Yes      | UUID of the parent area      |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns children areas

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "uuid-of-child-1",
      "name": "Gulshan 1",
      "parent_area_id": "uuid-of-parent",
      "city": "Dhaka",
      "created_at": "2026-07-28T10:00:00.000Z",
      "updated_at": "2026-07-28T10:00:00.000Z",
      "_count": {
        "children": 0
      }
    },
    {
      "id": "uuid-of-child-2",
      "name": "Gulshan 2",
      "parent_area_id": "uuid-of-parent",
      "city": "Dhaka",
      "created_at": "2026-07-28T10:00:00.000Z",
      "updated_at": "2026-07-28T10:00:00.000Z",
      "_count": {
        "children": 2
      }
    }
  ]
}
```

#### ✅ 200 OK — Area has no children

```json
{
  "success": true,
  "message": "OK",
  "data": []
}
```

#### ❌ 404 Not Found — Parent area not found

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

---

## 4. POST /v1/areas

> 🔒 **Requires `manage_areas` permission** — Admin only.
>
> Rate limited: 10 requests per 60 seconds.

Create a new area.

### Request Body

```json
{
  "name": "Gulshan",
  "parent_area_id": "uuid-of-parent-city",
  "city": "Dhaka",
  "boundary": "POLYGON((...))",
  "centroid": "POINT(...)"
}
```

| Field            | Type   | Required | Description                                      |
|------------------|--------|----------|--------------------------------------------------|
| `name`           | string | Yes      | Area name (max 255 characters)                   |
| `parent_area_id` | string | No       | UUID of the parent area (null for root areas)    |
| `city`           | string | No       | City name (defaults to `"Dhaka"` if omitted)     |
| `boundary`       | string | No       | GeoJSON boundary polygon string                  |
| `centroid`       | string | No       | GeoJSON centroid point string                    |

### Possible Responses

#### ✅ 201 Created — Area created

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-new-area",
    "name": "Gulshan"
  }
}
```

#### ❌ 409 Conflict — Area already exists in this city

```json
{
  "success": false,
  "message": "An area with this name already exists in the specified city",
  "error_code": 1401,
  "data": null
}
```

#### ❌ 403 Forbidden — Insufficient permissions

```json
{
  "success": false,
  "message": "Forbidden resource",
  "error_code": 1003,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "name must be a string; name must be longer than or equal to 1 characters; name must be shorter than or equal to 255 characters",
  "error_code": 1001,
  "data": {
    "errors": [
      "name must be a string",
      "name must be longer than or equal to 1 characters",
      "name must be shorter than or equal to 255 characters"
    ]
  }
}
```

#### ❌ 401 Unauthorized — Missing/invalid JWT

```json
{
  "success": false,
  "message": "Access token is invalid or has expired",
  "error_code": 1106,
  "data": null
}
```

---

## 5. PATCH /v1/areas/:id

> 🔒 **Requires `manage_areas` permission** — Admin only.
>
> Rate limited: 10 requests per 60 seconds.

Update an existing area. All fields are optional — only provided fields will be updated.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the area to update |

### Request Body

```json
{
  "name": "Gulshan Updated",
  "parent_area_id": "uuid-of-new-parent",
  "city": "Dhaka",
  "boundary": "POLYGON((...))",
  "centroid": "POINT(...)"
}
```

| Field            | Type   | Required | Description                                      |
|------------------|--------|----------|--------------------------------------------------|
| `name`           | string | No       | Area name (max 255 chars)                        |
| `parent_area_id` | string | No       | UUID of the new parent, or `null` to disconnect  |
| `city`           | string | No       | City name                                        |
| `boundary`       | string | No       | GeoJSON boundary polygon string                  |
| `centroid`       | string | No       | GeoJSON centroid point string                    |

### Possible Responses

#### ✅ 200 OK — Area updated

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-area"
  }
}
```

#### ❌ 404 Not Found — Area not found

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

#### ❌ 403 Forbidden — Insufficient permissions

```json
{
  "success": false,
  "message": "Forbidden resource",
  "error_code": 1003,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "name must be shorter than or equal to 255 characters",
  "error_code": 1001,
  "data": {
    "errors": ["name must be shorter than or equal to 255 characters"]
  }
}
```

#### ❌ 401 Unauthorized — Missing/invalid JWT

```json
{
  "success": false,
  "message": "Access token is invalid or has expired",
  "error_code": 1106,
  "data": null
}
```

---

## 6. DELETE /v1/areas/:id

> 🔒 **Requires `manage_areas` permission** — Admin only.
>
> Rate limited: 10 requests per 60 seconds.

Delete an area. Cannot delete an area that has active property listings.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the area to delete |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Area deleted successfully

```json
{
  "success": true,
  "message": "Area deleted successfully",
  "data": null
}
```

#### ❌ 404 Not Found — Area not found

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

#### ❌ 400 Bad Request — Area has active listings

```json
{
  "success": false,
  "message": "Cannot delete area with active property listings",
  "error_code": 1402,
  "data": null
}
```

#### ❌ 403 Forbidden — Insufficient permissions

```json
{
  "success": false,
  "message": "Forbidden resource",
  "error_code": 1003,
  "data": null
}
```

#### ❌ 401 Unauthorized — Missing/invalid JWT

```json
{
  "success": false,
  "message": "Access token is invalid or has expired",
  "error_code": 1106,
  "data": null
}
```

---

## Area Hierarchy Structure

The Area module supports a tree-like hierarchy:

```
City (parent_area_id = null)
  └── Zone/Thana (parent_area_id = city_id)
       └── Neighborhood/Block (parent_area_id = zone_id)
```

**Example:** `Dhaka City` → `Gulshan` → `Gulshan 1`

When querying areas:
- `GET /v1/areas` lists all areas (paginated)
- `GET /v1/areas/:id/children` gets immediate children
- `GET /v1/areas/:id` gets area with both parent and children

## Common Error Codes Reference (Area)

| Code | Message                                                        | HTTP Status |
|------|----------------------------------------------------------------|-------------|
| 1400 | Area not found                                                 | 404         |
| 1401 | An area with this name already exists in the specified city    | 409         |
| 1402 | Cannot delete area with active property listings                | 400         |
| 1003 | Forbidden resource                                              | 403         |
| 1106 | Access token is invalid or has expired                         | 401         |
| 1001 | Request validation failed                                       | 400         |
