# Property Module — Frontend Integration Guide

> **Base URL:** `http://localhost:3000/v1/properties`
>
> **Branch:** All work must be done on the **`dev`** branch.
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
>   "error_code": 1500,
>   "data": null
> }
> ```
>
> **Auth:** Public read endpoints (GET) require NO auth. Authenticated user endpoints (POST, PATCH, DELETE) require JWT. Admin endpoints require `manage_properties` permission.

---

## Property Status Lifecycle

```
  ┌───────┐
  │ draft │  ← Initial state when required fields are missing
  └───┬───┘
      │ Submit POST /:id/submit  (all required fields filled → status becomes "pending")
      ▼
  ┌─────────┐
  │ pending │  ← Waiting for admin verification
  └───┬─────┘
      │ Background task processes (MockVerificationService always approves)
      ▼
  ┌────────┐
  │ active │  ← Published & visible to public
  └───┬────┘
      │ Admin can set "sold" via PATCH /:id/admin
      ▼
  ┌───────┐
  │ sold  │
  └───┬───┘
      │ DELETE /:id → soft delete (archived)
      ▼
  ┌──────────┐
  │ archived │
  └──────────┘
```

**Property Enums:**

| Enum | Values |
|------|--------|
| `PropertyType` | `residential`, `commercial`, `land`, `parking` |
| `ListingType` | `sale`, `rent` |
| `PropertyStatus` | `draft`, `pending`, `active`, `sold`, `archived` |
| `MediaType` | `image`, `video` |

**Auto-status logic on create/update:** If `title`, `type`, `listing_type`, and `price` are all provided → status = `pending`. If any is missing → status = `draft`.

---

## 1. GET /v1/properties

> **Public** — No auth required.

List published (active) properties with filtering, pagination, and optional proximity search. Uses caching.

### Query Parameters

| Parameter     | Type    | Required | Description                                                    |
|---------------|---------|----------|----------------------------------------------------------------|
| `city`        | string  | No       | Filter by city name                                            |
| `area_id`     | string  | No       | Filter by area UUID                                            |
| `type`        | enum    | No       | `residential`, `commercial`, `land`, `parking`                 |
| `listing_type`| enum    | No       | `sale`, `rent`                                                 |
| `status`      | enum    | No       | *(Ignored for public — always returns `active`)*               |
| `min_price`   | number  | No       | Minimum price (>= 0)                                           |
| `max_price`   | number  | No       | Maximum price (>= 0)                                           |
| `min_area`    | number  | No       | Minimum area size (>= 0)                                       |
| `max_area`    | number  | No       | Maximum area size (>= 0)                                       |
| `bedrooms`    | number  | No       | Exact bedroom count (filters amenities.bedrooms)               |
| `bathrooms`   | number  | No       | Exact bathroom count (filters amenities.bathrooms)             |
| `search`      | string  | No       | Case-insensitive search in title & description                 |
| `is_verified` | boolean | No       | `true` or `false`                                              |
| `sort_by`     | string  | No       | `price_asc`, `price_desc`, `created_at_asc`, `created_at_desc`, `view_count_desc` (default: `created_at_desc`) |
| `page`        | number  | No       | Page number (default: 1, min: 1)                               |
| `limit`       | number  | No       | Items per page (default: 20, min: 1, max: 100)                 |
| `lat`         | number  | No*      | Latitude for proximity search                                  |
| `lng`         | number  | No*      | Longitude for proximity search                                 |
| `radius`      | number  | No*      | Search radius in km (min: 1, max: 50)                          |

> **Proximity search** (`lat`, `lng`, `radius`): All 3 params must be provided together. Results include a `distance` field (in km). Sorted by nearest first.

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns paginated properties

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid-of-property",
        "user_id": "uuid-of-owner",
        "area_id": "uuid-of-area",
        "title": "Modern Apartment in Gulshan",
        "description": "A beautiful 3-bedroom apartment with scenic views.",
        "type": "residential",
        "subtype": "apartment",
        "listing_type": "rent",
        "price": 35000,
        "price_currency": "BDT",
        "area_size": 1200,
        "area_unit": "sqft",
        "location_lat": 23.7925,
        "location_lng": 90.4078,
        "address": "123 Gulshan Avenue, Dhaka",
        "amenities": {
          "bedrooms": 3,
          "bathrooms": 2,
          "balcony": true,
          "parking": true
        },
        "status": "active",
        "is_verified": true,
        "virtual_tour_url": "https://tour.example.com/uuid",
        "view_count": 42,
        "published_at": "2026-07-28T10:00:00.000Z",
        "created_at": "2026-07-28T10:00:00.000Z",
        "updated_at": "2026-07-28T14:00:00.000Z",
        "area": {
          "id": "uuid-of-area",
          "name": "Gulshan",
          "city": "Dhaka"
        },
        "user": {
          "id": "uuid-of-owner",
          "full_name": "Swaron",
          "avatar_url": "https://res.cloudinary.com/.../avatar.jpg"
        },
        "media": [
          {
            "id": "uuid-of-media",
            "url": "https://res.cloudinary.com/.../image.jpg",
            "thumbnail_url": "https://res.cloudinary.com/.../thumb.jpg"
          }
        ],
        "_count": {
          "media": 5
        }
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "total_pages": 5
  }
}
```

#### ✅ 200 OK — Proximity search results (with distance)

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid-of-property",
        "title": "Nearby Apartment",
        "type": "residential",
        "listing_type": "rent",
        "price": 25000,
        "status": "active",
        "is_verified": true,
        "location_lat": 23.7950,
        "location_lng": 90.4100,
        "area": { "id": "uuid", "name": "Gulshan", "city": "Dhaka" },
        "user": { "id": "uuid", "full_name": "Owner Name", "avatar_url": null },
        "media": [],
        "_count": { "media": 0 },
        "distance": 1.25
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

> Note: The proximity search response includes a `distance` field (in km) on each item, showing how far the property is from the queried coordinates.

#### ✅ 200 OK — Empty results (no matching properties)

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

## 2. GET /v1/properties/admin

> 🔒 **Requires `manage_properties` permission** — Admin only.

List ALL properties (including non-active: draft, pending, sold, archived). Same query parameters as public endpoint, but no status filter restriction. No caching.

### Query Parameters

Same as `GET /v1/properties`. The `status` filter works here (unlike public).

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns paginated properties (admin view)

Same shape as public listing but includes all statuses, and user includes email/phone:

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid-of-property",
        "user_id": "uuid-of-owner",
        "area_id": "uuid-of-area",
        "title": "Draft Apartment",
        "description": null,
        "type": "residential",
        "subtype": null,
        "listing_type": "sale",
        "price": 0,
        "price_currency": "BDT",
        "area_size": null,
        "area_unit": "sqft",
        "location_lat": null,
        "location_lng": null,
        "address": null,
        "amenities": null,
        "status": "draft",
        "is_verified": false,
        "virtual_tour_url": null,
        "view_count": 0,
        "published_at": null,
        "created_at": "2026-07-28T10:00:00.000Z",
        "updated_at": "2026-07-28T10:00:00.000Z",
        "area": { "id": "uuid", "name": "Gulshan", "city": "Dhaka" },
        "user": {
          "id": "uuid-of-owner",
          "full_name": "Swaron",
          "avatar_url": null,
          "auth_identities": [
            {
              "email": "s@g.com",
              "phone": null
            }
          ]
        },
        "media": [],
        "_count": { "media": 0 }
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  }
}
```

> **Note:** Admin view includes `auth_identities` with `email` and `phone` inside the `user` object — this is NOT exposed to regular users.

#### ❌ 403 Forbidden — Insufficient permissions

```json
{
  "success": false,
  "message": "Forbidden resource",
  "error_code": 1003,
  "data": null
}
```

---

## 3. GET /v1/properties/my

> 🔒 **Requires JWT** — Authenticated user only.

Get all properties belonging to the currently authenticated user (all statuses). No caching.

### Query Parameters

Same as `GET /v1/properties`. The `status` filter works here.

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns user's properties

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid-of-property",
        "user_id": "uuid-of-current-user",
        "area_id": "uuid-of-area",
        "title": "My Apartment",
        "description": "Description here",
        "type": "residential",
        "subtype": "apartment",
        "listing_type": "rent",
        "price": 30000,
        "price_currency": "BDT",
        "area_size": 1000,
        "area_unit": "sqft",
        "location_lat": 23.7925,
        "location_lng": 90.4078,
        "address": "456 Road, Dhaka",
        "amenities": { "bedrooms": 2, "bathrooms": 1 },
        "status": "pending",
        "is_verified": false,
        "virtual_tour_url": null,
        "view_count": 5,
        "published_at": null,
        "created_at": "2026-07-28T10:00:00.000Z",
        "updated_at": "2026-07-28T10:00:00.000Z",
        "area": { "id": "uuid", "name": "Banani", "city": "Dhaka" },
        "media": [
          {
            "id": "uuid-of-media",
            "url": "https://res.cloudinary.com/.../image.jpg",
            "thumbnail_url": "https://res.cloudinary.com/.../thumb.jpg"
          }
        ],
        "_count": { "media": 3 }
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

#### ✅ 200 OK — User has no properties

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

## 4. GET /v1/properties/:id

> **Public** — No auth required.

Get a single published (active) property with full details including all media. Uses caching. Increments view count.

### Parameters

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `id`      | string | Yes      | UUID of the property         |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns property detail

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "user_id": "uuid-of-owner",
    "area_id": "uuid-of-area",
    "title": "Modern Apartment in Gulshan",
    "description": "A beautiful 3-bedroom apartment with scenic views.",
    "type": "residential",
    "subtype": "apartment",
    "listing_type": "rent",
    "price": 35000,
    "price_currency": "BDT",
    "area_size": 1200,
    "area_unit": "sqft",
    "location_lat": 23.7925,
    "location_lng": 90.4078,
    "address": "123 Gulshan Avenue, Dhaka",
    "amenities": {
      "bedrooms": 3,
      "bathrooms": 2,
      "balcony": true,
      "parking": true
    },
    "status": "active",
    "is_verified": true,
    "virtual_tour_url": "https://tour.example.com/uuid",
    "view_count": 43,
    "published_at": "2026-07-28T10:00:00.000Z",
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T14:00:00.000Z",
    "area": {
      "id": "uuid-of-area",
      "name": "Gulshan",
      "city": "Dhaka",
      "parent": {
        "id": "uuid-of-parent",
        "name": "Dhaka City"
      }
    },
    "user": {
      "id": "uuid-of-owner",
      "full_name": "Swaron",
      "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
      "auth_identities": [
        {
          "email": "s@g.com",
          "phone": null
        }
      ]
    },
    "media": [
      {
        "id": "uuid-of-media-1",
        "media_type": "image",
        "url": "https://res.cloudinary.com/.../photo1.jpg",
        "thumbnail_url": "https://res.cloudinary.com/.../thumb1.jpg",
        "display_order": 0
      },
      {
        "id": "uuid-of-media-2",
        "media_type": "image",
        "url": "https://res.cloudinary.com/.../photo2.jpg",
        "thumbnail_url": "https://res.cloudinary.com/.../thumb2.jpg",
        "display_order": 1
      }
    ],
    "_count": {
      "media": 2
    }
  }
}
```

> **Note:** Detail view includes ALL media (not just the first image) and the area hierarchy via `area.parent`.

#### ❌ 404 Not Found — Property not found or not active

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

## 5. POST /v1/properties

> 🔒 **Requires JWT** — Authenticated user only.
>
> Rate limited: 10 requests per 60 seconds.

Create a new property (or update if `property_id` is provided — upsert).

If `title`, `type`, `listing_type`, and `price` are all present → status = `pending`. Otherwise → status = `draft`.

### Request Body

```json
{
  "property_id": "uuid-of-existing-property",
  "area_id": "uuid-of-area",
  "title": "Modern Apartment in Gulshan",
  "description": "A beautiful 3-bedroom apartment with scenic views.",
  "type": "residential",
  "subtype": "apartment",
  "listing_type": "rent",
  "price": 35000,
  "price_currency": "BDT",
  "area_size": 1200,
  "area_unit": "sqft",
  "location_lat": 23.7925,
  "location_lng": 90.4078,
  "address": "123 Gulshan Avenue, Dhaka",
  "amenities": {
    "bedrooms": 3,
    "bathrooms": 2,
    "balcony": true,
    "parking": true
  },
  "virtual_tour_url": "https://tour.example.com/uuid",
  "status": "active"
}
```

| Field             | Type   | Required | Description                                                              |
|-------------------|--------|----------|--------------------------------------------------------------------------|
| `property_id`     | string | No       | If provided, UPDATES the existing property instead of creating a new one |
| `area_id`         | string | Yes*     | UUID of the area (*required for CREATE, optional for UPDATE)             |
| `title`           | string | No       | Property title (max 255 chars)                                           |
| `description`     | string | No       | Property description (max 5000 chars)                                    |
| `type`            | enum   | No       | `residential` (default), `commercial`, `land`, `parking`                 |
| `subtype`         | string | No       | e.g. `apartment`, `villa`, `office`, `shop`, `plot`                      |
| `listing_type`    | enum   | No       | `sale` (default), `rent`                                                 |
| `price`           | number | No       | Price (>= 0, default: 0)                                                 |
| `price_currency`  | string | No       | 3-letter currency code (default: `BDT`)                                  |
| `area_size`       | number | No       | Property area size (>= 0)                                                |
| `area_unit`       | string | No       | Area unit (default: `sqft`)                                              |
| `location_lat`    | number | No       | Latitude coordinate                                                      |
| `location_lng`    | number | No       | Longitude coordinate                                                     |
| `address`         | string | No       | Property address (max 500 chars)                                         |
| `amenities`       | object | No       | JSON object with property-specific amenities                             |
| `virtual_tour_url`| string | No       | Valid URL to a virtual tour                                              |
| `status`          | enum   | No       | (Admin only on update) `draft`, `pending`, `active`, `sold`, `archived`  |

> **Creating vs Updating:** To create, omit `property_id`. To update, include `property_id` with the UUID of an existing property you own. Only provided fields are updated.
>
> **Auto draft/pending:** If `title`, `type`, `listing_type`, and `price` are all filled → `pending`. Missing any → `draft`.

### Possible Responses (Create)

#### ✅ 201 Created — Property created

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-new-property",
    "title": "Modern Apartment in Gulshan"
  }
}
```

#### ❌ 400 Bad Request — area_id is required for creation

```json
{
  "success": false,
  "message": "area_id is required for property creation",
  "error_code": 1502,
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

#### ❌ 400 Bad Request — Invalid amenities for property type

```json
{
  "success": false,
  "message": "Invalid amenities structure for the specified property type",
  "error_code": 1503,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "title must be shorter than or equal to 255 characters; price must not be less than 0",
  "error_code": 1001,
  "data": {
    "errors": [
      "title must be shorter than or equal to 255 characters",
      "price must not be less than 0"
    ]
  }
}
```

### Possible Responses (Update — via property_id)

#### ✅ 200 OK — Property updated

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property"
  }
}
```

#### ❌ 404 Not Found — Property not found

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

#### ❌ 403 Forbidden — Not the owner

```json
{
  "success": false,
  "message": "You do not have permission to update this property",
  "error_code": 1003,
  "data": null
}
```

#### ❌ 404 Not Found — Area not found (when changing area_id)

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
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

## 6. PATCH /v1/properties/:id

> ⚠️ **Deprecated** — Use `POST /v1/properties` with `property_id` in the body instead.
>
> 🔒 **Requires JWT** — Authenticated user only.
>
> Rate limited: 10 requests per 60 seconds.

Update an existing property. This delegates to the same `upsert` logic as POST with `property_id`.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the property     |

### Request Body

Same shape as `POST /v1/properties` (minus `property_id` — it's taken from the URL).

```json
{
  "title": "Updated Title",
  "price": 40000,
  "description": "Updated description..."
}
```

### Possible Responses

Same as the update path of `POST /v1/properties`.

#### ✅ 200 OK — Property updated

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property"
  }
}
```

#### ❌ 404 Not Found — Property not found

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

#### ❌ 403 Forbidden — Not the owner

```json
{
  "success": false,
  "message": "You do not have permission to update this property",
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

## 7. POST /v1/properties/:id/submit

> 🔒 **Requires JWT** — Authenticated user only. Must be the property owner.
>
> Rate limited: 10 requests per 60 seconds.
>
> HTTP Status: **202 Accepted**

Submit a `pending` property for admin verification. The property must:
- Be owned by the requesting user
- Have status = `pending` (i.e., all required fields: title, type, listing_type, price)
- Have all required fields filled (title, description, type, listing_type, price > 0, area_id, area_size > 0, area_unit, address, location_lat, location_lng)
- Have at least 1 media item

On success, a background task schedules the verification process (mock verification always approves).

### Parameters

| Parameter | Type   | Required | Description                  |
|-----------|--------|----------|------------------------------|
| `id`      | string | Yes      | UUID of the property         |

### Request Body

None.

### Possible Responses

#### ✅ 202 Accepted — Property submitted for verification

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "status": "pending"
  }
}
```

#### ❌ 404 Not Found — Property not found

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

#### ❌ 403 Forbidden — Not the owner

```json
{
  "success": false,
  "message": "You do not have permission to submit this property",
  "error_code": 1003,
  "data": null
}
```

#### ❌ 400 Bad Request — Status must be "pending"

```json
{
  "success": false,
  "message": "Only draft properties can be submitted for review",
  "error_code": 1521,
  "data": null
}
```

> **Note:** The error message says "Only draft properties" but the actual check is `status !== 'pending'`. If a property has status "draft" (missing required fields), you'll get this error — you need to fill in all required fields first via POST/PATCH to bring status to "pending".

#### ❌ 400 Bad Request — Missing required fields

```json
{
  "success": false,
  "message": "Missing required fields: title, description, area_size, area_unit, address, location_lat, location_lng, media (at least 1 required)",
  "error_code": 1521,
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

## 8. DELETE /v1/properties/:id

> 🔒 **Requires JWT** — Authenticated user only. Must be the property owner.
>
> Rate limited: 10 requests per 60 seconds.

Soft delete (archive) a property. The property's status is set to `archived`.

Can only archive properties with status `active` or `sold`.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the property     |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Property archived

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property"
  }
}
```

#### ❌ 404 Not Found — Property not found

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

#### ❌ 403 Forbidden — Not the owner

```json
{
  "success": false,
  "message": "You do not have permission to delete this property",
  "error_code": 1003,
  "data": null
}
```

#### ❌ 400 Bad Request — Cannot archive in current status

```json
{
  "success": false,
  "message": "Only active or sold properties can be archived",
  "error_code": 1522,
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

## 9. POST /v1/properties/:id/media

> 🔒 **Requires JWT** — Authenticated user only. Must be the property owner.
>
> Rate limited: 10 requests per 60 seconds.
>
> **Multipart/form-data** — Uses file upload.

Add media (image or video) to a property. The actual media type is determined from the file's MIME type, NOT from the `media_type` field. Images max 10MB, videos max 100MB.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the property     |

### Request Body (multipart/form-data)

| Field          | Type   | Required | Description                                          |
|----------------|--------|----------|------------------------------------------------------|
| `file`         | file   | Yes      | The media file (JPEG, PNG, WebP for images; MP4, MOV for videos) |
| `media_type`   | string | Yes      | `image` or `video` (used for limit counting, not actual type)    |
| `display_order`| number | No       | Display order (auto-assigned if omitted)             |

> **Important:** The `media_type` field in the body is used for counting limits (max 20 images, 3 videos per property). The actual file type is detected from the uploaded file's MIME type. If they mismatch, the system uses the file's actual type for storage but counts against the declared `media_type` limit.

### Possible Responses

#### ✅ 201 Created — Media added

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-media",
    "property_id": "uuid-of-property",
    "media_type": "image",
    "url": "https://res.cloudinary.com/.../image.jpg",
    "public_id": "cloudinary-public-id",
    "thumbnail_url": "https://res.cloudinary.com/.../thumb.jpg",
    "display_order": 2
  }
}
```

#### ❌ 404 Not Found — Property not found

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

#### ❌ 403 Forbidden — Not the owner

```json
{
  "success": false,
  "message": "You do not have permission to add media to this property",
  "error_code": 1003,
  "data": null
}
```

#### ❌ 400 Bad Request — Invalid file type

```json
{
  "success": false,
  "message": "Invalid file type. Allowed types: JPEG, PNG, WebP (images), MP4, MOV (videos)",
  "error_code": 1511,
  "data": null
}
```

#### ❌ 400 Bad Request — File too large

```json
{
  "success": false,
  "message": "File size exceeds the maximum allowed limit",
  "error_code": 1512,
  "data": null
}
```

#### ❌ 400 Bad Request — Media limit reached

```json
{
  "success": false,
  "message": "Media limit reached for this property",
  "error_code": 1513,
  "data": null
}
```

#### ❌ 500 Internal Server Error — Upload failed

```json
{
  "success": false,
  "message": "Failed to upload media to storage",
  "error_code": 1514,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "media_type must be one of the following values: image, video",
  "error_code": 1001,
  "data": {
    "errors": [
      "media_type must be one of the following values: image, video"
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

## 10. DELETE /v1/properties/media/:mediaId

> 🔒 **Requires JWT** — Authenticated user only. Must be the property owner.
>
> Rate limited: 10 requests per 60 seconds.

Remove media from a property. Deletes from Cloudinary storage and removes the database record.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `mediaId` | string | Yes      | UUID of the media        |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Media removed

```json
{
  "success": true,
  "message": "OK",
  "data": null
}
```

#### ❌ 404 Not Found — Media not found

```json
{
  "success": false,
  "message": "Media not found",
  "error_code": 1510,
  "data": null
}
```

#### ❌ 403 Forbidden — Not the property owner

```json
{
  "success": false,
  "message": "You do not have permission to remove this media",
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

## 11. PATCH /v1/properties/:id/admin

> 🔒 **Requires `manage_properties` permission** — Admin only.
>
> Rate limited: 10 requests per 60 seconds.

Admin update a property. Same as user update but **can override ANY property including status**, does not check ownership.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the property     |

### Request Body

Same as `POST /v1/properties`. Admins can set `status` to any valid value (`draft`, `pending`, `active`, `sold`, `archived`).

```json
{
  "title": "Admin Updated Title",
  "status": "active",
  "price": 50000,
  "is_verified": true
}
```

> **Note:** The `is_verified` field is NOT directly updatable via this endpoint — it's set by the verification system. However, admins can change `status` directly.

### Possible Responses

#### ✅ 200 OK — Property updated by admin

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property"
  }
}
```

#### ❌ 404 Not Found — Property not found

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
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

## 12. DELETE /v1/properties/:id/admin

> 🔒 **Requires `manage_properties` permission** — Admin only.
>
> Rate limited: 10 requests per 60 seconds.

**Hard delete** a property — permanently removes it from the database. Cannot be undone. Does NOT delete Cloudinary media files.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the property     |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Property permanently deleted

```json
{
  "success": true,
  "message": "OK",
  "data": null
}
```

#### ❌ 404 Not Found — Property not found

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
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

## Appendix A: Endpoint Summary

| # | Method | Path | Auth | Permission | Rate Limit | Description |
|---|--------|------|------|------------|------------|-------------|
| 1 | GET | `/v1/properties` | Public | — | 60/60s | List published properties |
| 2 | GET | `/v1/properties/admin` | JWT | `manage_properties` | 60/60s | Admin list all properties |
| 3 | GET | `/v1/properties/my` | JWT | — | 60/60s | User's own properties |
| 4 | GET | `/v1/properties/:id` | Public | — | 60/60s | Get property detail |
| 5 | POST | `/v1/properties` | JWT | — | 10/60s | Create/update property |
| 6 | PATCH | `/v1/properties/:id` | JWT | — | 10/60s | Update property (deprecated) |
| 7 | POST | `/v1/properties/:id/submit` | JWT | — | 10/60s | Submit for verification |
| 8 | DELETE | `/v1/properties/:id` | JWT | — | 10/60s | Soft delete (archive) |
| 9 | POST | `/v1/properties/:id/media` | JWT | — | 10/60s | Add media (multipart) |
| 10 | DELETE | `/v1/properties/media/:mediaId` | JWT | — | 10/60s | Remove media |
| 11 | PATCH | `/v1/properties/:id/admin` | JWT | `manage_properties` | 10/60s | Admin update |
| 12 | DELETE | `/v1/properties/:id/admin` | JWT | `manage_properties` | 10/60s | Admin hard delete |

## Appendix B: Common Error Codes Reference (Property)

| Code | Message                                                           | HTTP Status |
|------|-------------------------------------------------------------------|-------------|
| 1500 | Property not found                                                | 404         |
| 1501 | You do not have permission to modify this property                | 403         |
| 1502 | area_id is required for property creation                         | 400         |
| 1503 | Invalid amenities structure for the specified property type       | 400         |
| 1510 | Media not found                                                   | 404         |
| 1511 | Invalid file type. Allowed types: JPEG, PNG, WebP (images), MP4, MOV (videos) | 400 |
| 1512 | File size exceeds the maximum allowed limit                       | 400         |
| 1513 | Media limit reached for this property                             | 400         |
| 1514 | Failed to upload media to storage                                 | 500         |
| 1520 | Cannot transition property to the requested status                | 400         |
| 1521 | Only draft properties can be submitted for review                 | 400         |
| 1522 | Only active or sold properties can be archived                    | 400         |

## Appendix C: Typical Property Creation Flow

```
1. POST /v1/properties           → { id: "prop-1", title: "..." }     ← Created as "draft" (missing fields)
2. POST /v1/properties/:id/media → { id: "media-1", url: "..." }     ← Upload images (multipart)
3. POST /v1/properties           → { id: "prop-1" }                   ← Update with all required fields → status becomes "pending"
   (with property_id + all required fields)
4. POST /v1/properties/:id/submit → { id: "prop-1", status: "pending" } ← Submit for verification (202 Accepted)
5. (Background)                   → Verification processes → status → "active"
6. GET /v1/properties/:id         → Full property detail              ← Now visible to public
```
