# Homenet API — Complete Endpoint Testing Guide

> **Base URL:** `http://localhost:3000`
> **Swagger UI:** `http://localhost:3000/api/docs`

All success responses are wrapped in a standard envelope:

```json
{
  "success": true,
  "message": "OK",
  "data": { ... }
}
```

Error responses follow this shape:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": 1100,
  "data": null
}
```

---

## Table of Contents

1. [Root](#1-root)
2. [Authentication](#2-authentication)
   - [Register](#21-register)
   - [Login](#22-login)
   - [Refresh Token](#23-refresh-token)
   - [Logout](#24-logout)
   - [Get Profile](#25-get-profile)
3. [Users](#3-users)
   - [List All Users](#31-list-all-users)
   - [Get User by ID](#32-get-user-by-id)
4. [Roles & Permissions](#4-roles--permissions)
   - [List All Roles](#41-list-all-roles)
   - [Get Role by ID](#42-get-role-by-id)
   - [Get User's Roles](#43-get-users-roles)
   - [Assign Role to User](#44-assign-role-to-user)
   - [Remove Role from User](#45-remove-role-from-user)
   - [Assign Permission to Role](#46-assign-permission-to-role)
   - [Remove Permission from Role](#47-remove-permission-from-role)
5. [Areas](#5-areas)
   - [List All Areas](#51-list-all-areas)
   - [Get Area by ID](#52-get-area-by-id)
   - [Get Area Children](#53-get-area-children)
   - [Create Area](#54-create-area)
   - [Update Area](#55-update-area)
   - [Delete Area](#56-delete-area)

---

## 1. Root

### `GET /`

Health-check endpoint. No authentication required.

**Request:**

```
GET http://localhost:3000
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": "Hello World!"
}
```

---

## 2. Authentication

### 2.1 Register

### `POST /auth/register`

Creates a new user account with a local (email/password) identity. No authentication required.

**Request:**

```
POST    
Content-Type: application/json
```

**Body:**

```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "password": "StrongP@ss123"
}
```

**Optional field:** `avatar_url` (a valid URL string).

**Response (201):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user": {
      "id": "uuid-of-new-user",
      "full_name": "John Doe",
      "email": "john@example.com",
      "avatar_url": null
    }
  }
}
```

**Error — Email already exists (409):**

```json
{
  "success": false,
  "message": "An account with this email already exists",
  "error_code": 1101,
  "data": null
}
```

**Error — Weak password (400):**

```json
{
  "success": false,
  "message": "Password does not meet strength requirements",
  "error_code": 1102,
  "data": null
}
```

**Error — Validation failure (400):**

```json
{
  "success": false,
  "message": "email must be an email; password should not be empty",
  "error_code": 1001,
  "data": {
    "errors": ["email must be an email", "password should not be empty"]
  }
}
```

---

### 2.2 Login

### `POST /auth/login`

Authenticates with email and password, returns tokens. No authentication required.

**Request:**

```
POST http://localhost:3000/auth/login
Content-Type: application/json
```

**Body:**

```json
{
  "email": "john@example.com",
  "password": "StrongP@ss123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "new-uuid-refresh-token",
    "user": {
      "id": "uuid-of-user",
      "full_name": "John Doe",
      "email": "john@example.com",
      "avatar_url": null
    }
  }
}
```

**Error — Invalid credentials (401):**

```json
{
  "success": false,
  "message": "Invalid email or password",
  "error_code": 1100,
  "data": null
}
```

---

### 2.3 Refresh Token

### `POST /auth/refresh`

Exchange a valid refresh token for a new token pair (rotation). No authentication required.

**Request:**

```
POST http://localhost:3000/auth/refresh
Content-Type: application/json
```

**Body:**

```json
{
  "refresh_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "new-uuid-refresh-token"
  }
}
```

**Error — Invalid token (401):**

```json
{
  "success": false,
  "message": "Invalid refresh token",
  "error_code": 1103,
  "data": null
}
```

**Error — Expired token (401):**

```json
{
  "success": false,
  "message": "Refresh token has expired",
  "error_code": 1104,
  "data": null
}
```

---

### 2.4 Logout

### `POST /auth/logout`

Revokes the provided refresh token. **JWT required.**

**Request:**

```
POST http://localhost:3000/auth/logout
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "refresh_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

---

### 2.5 Get Profile

### `GET /auth/me`

Returns the currently authenticated user's profile. **JWT required.**

**Request:**

```
GET http://localhost:3000/auth/me
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "John Doe",
    "avatar_url": null,
    "email": "john@example.com",
    "email_verified": false,
    "created_at": "2026-06-30T10:00:00.000Z"
  }
}
```

**Error — No token / Invalid token (401):**

```json
{
  "success": false,
  "message": "Access token is invalid or has expired",
  "error_code": 1106,
  "data": null
}
```

---

## 3. Users

> All user endpoints require a valid **JWT** token in the `Authorization` header.

---

### 3.1 List All Users

### `GET /users`

Returns all registered users with their identity details.

**Request:**

```
GET http://localhost:3000/users
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "uuid-of-user-1",
      "full_name": "John Doe",
      "avatar_url": null,
      "created_at": "2026-06-30T10:00:00.000Z",
      "updated_at": "2026-06-30T10:00:00.000Z",
      "auth_identities": [
        {
          "provider": "LOCAL",
          "email": "john@example.com",
          "phone": null,
          "verified_at": null
        }
      ]
    }
  ]
}
```

---

### 3.2 Get User by ID

### `GET /users/:id`

Returns a single user's details.

**Request:**

```
GET http://localhost:3000/users/uuid-of-user
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "John Doe",
    "avatar_url": null,
    "created_at": "2026-06-30T10:00:00.000Z",
    "updated_at": "2026-06-30T10:00:00.000Z",
    "auth_identities": [
      {
        "provider": "LOCAL",
        "email": "john@example.com",
        "phone": null,
        "verified_at": null
      }
    ]
  }
}
```

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "The requested resource was not found",
  "error_code": 1002,
  "data": null
}
```

---

## 4. Roles & Permissions

> All role/permission endpoints require a valid **JWT** token.  
> Endpoints marked with a permission require that the authenticated user has been assigned a role that includes the specified permission.

| Permission Required | Endpoints |
|---|---|
| `view_roles` | `GET /roles`, `GET /roles/:id`, `GET /roles/user/:userId` |
| `manage_roles` | `POST /roles/assign`, `DELETE /roles/revoke`, `POST /roles/:roleId/permissions`, `DELETE /roles/:roleId/permissions/:permissionId` |

---

### 4.1 List All Roles

### `GET /roles`

Returns all roles with their associated permissions. Requires `view_roles` permission.

**Request:**

```
GET http://localhost:3000/roles
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "uuid-of-role",
      "name": "admin",
      "created_at": "2026-06-30T10:00:00.000Z",
      "role_permissions": [
        {
          "id": "uuid-of-rp",
          "role_id": "uuid-of-role",
          "permission_id": "uuid-of-permission",
          "permission": {
            "id": "uuid-of-permission",
            "name": "view_roles",
            "created_at": "2026-06-30T10:00:00.000Z"
          }
        }
      ]
    }
  ]
}
```

---

### 4.2 Get Role by ID

### `GET /roles/:id`

Returns a single role with its permissions. Requires `view_roles` permission.

**Request:**

```
GET http://localhost:3000/roles/uuid-of-role
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-role",
    "name": "admin",
    "created_at": "2026-06-30T10:00:00.000Z",
    "role_permissions": [
      {
        "id": "uuid-of-rp",
        "role_id": "uuid-of-role",
        "permission_id": "uuid-of-permission",
        "permission": {
          "id": "uuid-of-permission",
          "name": "view_roles",
          "created_at": "2026-06-30T10:00:00.000Z"
        }
      }
    ]
  }
}
```

---

### 4.3 Get User's Roles

### `GET /roles/user/:userId`

Returns all roles assigned to a specific user. Requires `view_roles` permission.

**Request:**

```
GET http://localhost:3000/roles/user/uuid-of-user
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "uuid-of-user-role",
      "user_id": "uuid-of-user",
      "role_id": "uuid-of-role",
      "assigned_by": null,
      "created_at": "2026-06-30T10:00:00.000Z",
      "role": {
        "id": "uuid-of-role",
        "name": "admin",
        "created_at": "2026-06-30T10:00:00.000Z"
      }
    }
  ]
}
```

---

### 4.4 Assign Role to User

### `POST /roles/assign`

Assigns a role to a user. Requires `manage_roles` permission.

**Request:**

```
POST http://localhost:3000/roles/assign
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "userId": "uuid-of-user",
  "roleId": "uuid-of-role"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user-role",
    "user_id": "uuid-of-user",
    "role_id": "uuid-of-role",
    "assigned_by": null,
    "created_at": "2026-06-30T10:00:00.000Z"
  }
}
```

**Error — Already assigned (409):**

```json
{
  "success": false,
  "message": "Role is already assigned to this user",
  "error_code": 1301,
  "data": null
}
```

---

### 4.5 Remove Role from User

### `DELETE /roles/revoke`

Revokes a role from a user. Requires `manage_roles` permission.

**Request:**

```
DELETE http://localhost:3000/roles/revoke
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "userId": "uuid-of-user",
  "roleId": "uuid-of-role"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "count": 1
  }
}
```

---

### 4.6 Assign Permission to Role

### `POST /roles/:roleId/permissions`

Attaches a permission to a role. Requires `manage_roles` permission.

**Request:**

```
POST http://localhost:3000/roles/uuid-of-role/permissions
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "permissionId": "uuid-of-permission"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-role-permission",
    "role_id": "uuid-of-role",
    "permission_id": "uuid-of-permission"
  }
}
```

**Error — Already assigned (409):**

```json
{
  "success": false,
  "message": "Permission is already assigned to this role",
  "error_code": 1303,
  "data": null
}
```

---

### 4.7 Remove Permission from Role

### `DELETE /roles/:roleId/permissions/:permissionId`

Detaches a permission from a role. Requires `manage_roles` permission.

**Request:**

```
DELETE http://localhost:3000/roles/uuid-of-role/permissions/uuid-of-permission
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "count": 1
  }
}
```

---

## 5. Areas

> Public read endpoints (`GET /areas`, `GET /areas/:id`, `GET /areas/:id/children`) require **no authentication**.
> Write endpoints (`POST`, `PATCH`, `DELETE`) require a valid **JWT** and the `manage_areas` permission.

| Permission Required | Endpoints |
|---|---|
| `manage_areas` | `POST /areas`, `PATCH /areas/:id`, `DELETE /areas/:id` |

---

### 5.1 List All Areas

### `GET /areas`

Returns a paginated list of areas with optional filters. No authentication required.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `city` | string | No | Filter by city name |
| `parent_area_id` | string (UUID) | No | Filter by parent area |
| `search` | string | No | Case-insensitive name search |
| `page` | number | No | Page number (default: 1, min: 1) |
| `limit` | number | No | Items per page (default: 20, min: 1, max: 100) |

**Request:**

```
GET http://localhost:3000/areas?page=1&limit=20
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid-of-area",
        "name": "Gulshan",
        "parent_area_id": null,
        "city": "Dhaka",
        "created_at": "2026-07-05T10:00:00.000Z",
        "updated_at": "2026-07-05T10:00:00.000Z",
        "_count": {
          "children": 2
        }
      }
    ],
    "total": 31,
    "page": 1,
    "limit": 20,
    "total_pages": 2
  }
}
```

**Request with filters:**

```
GET http://localhost:3000/areas?city=Dhaka&search=Gulshan&parent_area_id=uuid-of-parent
```

---

### 5.2 Get Area by ID

### `GET /areas/:id`

Returns a single area with its parent and children details. No authentication required.

**Request:**

```
GET http://localhost:3000/areas/uuid-of-area
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-area",
    "name": "Gulshan",
    "parent_area_id": null,
    "city": "Dhaka",
    "created_at": "2026-07-05T10:00:00.000Z",
    "updated_at": "2026-07-05T10:00:00.000Z",
    "parent": null,
    "children": [
      {
        "id": "uuid-of-child",
        "name": "Gulshan-1"
      },
      {
        "id": "uuid-of-child-2",
        "name": "Gulshan-2"
      }
    ]
  }
}
```

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

---

### 5.3 Get Area Children

### `GET /areas/:id/children`

Returns all direct sub-areas (children) of the given area. No authentication required.

**Request:**

```
GET http://localhost:3000/areas/uuid-of-area/children
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "uuid-of-child",
      "name": "Gulshan-1",
      "parent_area_id": "uuid-of-area",
      "city": "Dhaka",
      "created_at": "2026-07-05T10:00:00.000Z",
      "updated_at": "2026-07-05T10:00:00.000Z",
      "_count": {
        "children": 0
      }
    }
  ]
}
```

**Error — Parent area not found (404):**

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

---

### 5.4 Create Area

### `POST /areas`

Creates a new area. Requires `manage_areas` permission.

**Request:**

```
POST http://localhost:3000/areas
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "name": "New Area",
  "city": "Dhaka",
  "parent_area_id": "uuid-of-parent-area"
}
```

**Optional fields:** `parent_area_id` (UUID of parent area), `city` (default: `"Dhaka"`), `boundary` (WKT polygon string e.g. `"POLYGON((...))"`), `centroid` (WKT point string e.g. `"POINT(90.41 23.79)"`).

**Response (201):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-new-area",
    "name": "New Area",
    "parent_area_id": "uuid-of-parent-area",
    "city": "Dhaka",
    "created_at": "2026-07-05T10:00:00.000Z",
    "updated_at": "2026-07-05T10:00:00.000Z"
  }
}
```

**Error — Duplicate (409):**

```json
{
  "success": false,
  "message": "An area with this name already exists in the specified city",
  "error_code": 1401,
  "data": null
}
```

**Error — Validation failure (400):**

```json
{
  "success": false,
  "message": "name should not be empty",
  "error_code": 1001,
  "data": {
    "errors": ["name should not be empty"]
  }
}
```

---

### 5.5 Update Area

### `PATCH /areas/:id`

Updates an existing area. All fields are optional. Requires `manage_areas` permission.

**Request:**

```
PATCH http://localhost:3000/areas/uuid-of-area
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "name": "Updated Area Name",
  "city": "Chittagong"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-area",
    "name": "Updated Area Name",
    "parent_area_id": null,
    "city": "Chittagong",
    "created_at": "2026-07-05T10:00:00.000Z",
    "updated_at": "2026-07-05T10:00:00.000Z"
  }
}
```

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

---

### 5.6 Delete Area

### `DELETE /areas/:id`

Deletes an area. Blocked if the area has active property listings. Requires `manage_areas` permission.

**Request:**

```
DELETE http://localhost:3000/areas/uuid-of-area
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "message": "Area deleted successfully"
  }
}
```

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

**Error — Has active listings (400):**

```json
{
  "success": false,
  "message": "Cannot delete area with active property listings",
  "error_code": 1402,
  "data": null
}
```

---

## 6. Properties — PropertyMedia

> **Note:** This section covers PropertyMedia operations only. Full Property CRUD documentation will be added separately.

### 6.1 Add Media to Property

### `POST /properties/:id/media`

Uploads an image or video file to a property. The file is uploaded to Cloudinary; the `public_id` is stored internally and never exposed in responses. Requires authentication as the property owner or `manage_properties` permission.

**Request:**

```
POST http://localhost:3000/properties/uuid-of-property/media
Content-Type: multipart/form-data
Authorization: Bearer <access_token>
```

**Form data fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image (JPEG/PNG/WebP) or video (MP4/MOV) |
| `media_type` | Text | Yes | `image` or `video` |
| `display_order` | Text | No | Integer >= 0 (auto-assigned if omitted) |

**Response (201):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-media",
    "property_id": "uuid-of-property",
    "media_type": "image",
    "url": "https://res.cloudinary.com/.../image/upload/v123/homenet/properties/.../image.jpg",
    "thumbnail_url": "https://res.cloudinary.com/.../image/upload/w_400,h_300,c_fill/v123/homenet/properties/.../image.jpg",
    "display_order": 0,
    "created_at": "2026-07-09T12:00:00.000Z"
  }
}
```

**Error — Property not found (404):**

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

**Error — Invalid file type (400):**

```json
{
  "success": false,
  "message": "Invalid file type. Allowed types: JPEG, PNG, WebP (images), MP4, MOV (videos)",
  "error_code": 1511,
  "data": null
}
```

**Error — File too large (400):**

```json
{
  "success": false,
  "message": "File size exceeds the maximum allowed limit",
  "error_code": 1512,
  "data": null
}
```

**Error — Media limit reached (400):**

```json
{
  "success": false,
  "message": "Media limit reached for this property",
  "error_code": 1513,
  "data": null
}
```

**Error — Not authorized (403):**

```json
{
  "success": false,
  "message": "You do not have permission to add media to this property",
  "error_code": 1003,
  "data": null
}
```

---

### 6.2 Remove Media from Property

### `DELETE /properties/media/:mediaId`

Deletes a media record from the database and removes the associated file from Cloudinary. Requires authentication as the property owner or `manage_properties` permission.

**Request:**

```
DELETE http://localhost:3000/properties/media/uuid-of-media
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": null
}
```

**Error — Media not found (404):**

```json
{
  "success": false,
  "message": "Media not found",
  "error_code": 1510,
  "data": null
}
```

**Error — Not authorized (403):**

```json
{
  "success": false,
  "message": "You do not have permission to remove this media",
  "error_code": 1003,
  "data": null
}
```

---

## Error Codes Quick Reference

| Code | Description | HTTP Status |
|------|-------------|:-----------:|
| 1000 | Internal server error | 500 |
| 1001 | Validation failed | 400 |
| 1002 | Resource not found | 404 |
| 1003 | Forbidden | 403 |
| 1100 | Invalid email or password | 401 |
| 1101 | Email already exists | 409 |
| 1102 | Password too weak | 400 |
| 1103 | Invalid refresh token | 401 |
| 1104 | Refresh token expired | 401 |
| 1105 | User identity not found | 401 |
| 1106 | JWT invalid or expired | 401 |
| 1107 | Authenticated user not found | 401 |
| 1200 | User not found | 404 |
| 1300 | Role not found | 404 |
| 1301 | Role already assigned | 409 |
| 1302 | Permission not found | 404 |
| 1303 | Permission already assigned | 409 |
| 1304 | Insufficient role | 403 |
| 1400 | Area not found | 404 |
| 1401 | Area already exists | 409 |
| 1402 | Cannot delete area with active listings | 400 |
| 1500 | Property not found | 404 |
| 1501 | Property access denied | 403 |
| 1503 | Invalid amenities structure | 400 |
| 1510 | Media not found | 404 |
| 1511 | Invalid file type | 400 |
| 1512 | File too large | 400 |
| 1513 | Media limit reached | 400 |
| 1514 | Media upload failed | 500 |

---

## Suggested Testing Flow

1. **Start** — Hit `GET /` to confirm the server is running
2. **Register** — Create an account via `POST /auth/register`
3. **Login** — Get tokens via `POST /auth/login`
4. **Get Profile** — Test your JWT with `GET /auth/me`
5. **List Users** — See all users via `GET /users`
6. **Refresh** — Rotate your tokens via `POST /auth/refresh`
7. **Logout** — Revoke a refresh token via `POST /auth/logout`
8. **List Areas** — View all seeded areas via `GET /areas` (no auth needed)
9. **Get Area Details** — View a single area via `GET /areas/:id` (no auth needed)
10. **Get Area Children** — View sub-areas via `GET /areas/:id/children` (no auth needed)
11. **Add Property Media** — Upload an image to a property via `POST /properties/:id/media` (multipart form-data with `file`, `media_type`, `display_order`)
12. **Add Another Image** — Upload a second image with `display_order: 1` to the same property
13. **Delete Property Media** — Remove a media item via `DELETE /properties/media/:mediaId` (verifies Cloudinary cleanup)
14. **Upload Invalid File Type** — Try uploading a `.pdf` file (expects error code 1511)
15. **Upload Oversized File** — Try uploading a file > 10 MB (expects error code 1512)
16. **Unauthorized Media Access** — Try uploading/deleting media as a non-owner (expects 403)

> **For Roles & Permissions**, you'll need to insert roles/permissions directly into the database first (there's no seed data). Use raw SQL or a Prisma script to create roles and permissions before testing those endpoints.
>
> **For Areas**, seed data is available. Run `npm run seed:areas` to populate 31 Dhaka areas (10 top-level + 21 children). Read endpoints require no authentication. Write endpoints (create/update/delete) require a JWT with the `manage_areas` permission.
>
> **For Property Media**, you'll need to create a property first (there's no seed data for properties). Use `POST /properties` with valid `area_id`, `title`, `type`, `listing_type`, and `price`. Property create requires authentication. Then use the property ID to test media upload/delete. Cloudinary environment variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) must be set in `.env` for media uploads to work.