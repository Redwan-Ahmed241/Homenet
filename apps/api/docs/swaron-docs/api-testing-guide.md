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
6. [Properties](#6-properties)
   - [List Properties](#61-list-properties)
   - [Get Property](#62-get-property)
   - [Create Property](#63-create-property)
   - [Update Property](#64-update-property)
   - [Delete Property](#65-delete-property)
   - [Add Media](#66-add-media)
   - [Remove Media](#67-remove-media)
   - [Admin: List All Properties](#68-admin-list-all-properties)
   - [Admin: Update Property](#69-admin-update-property)
   - [Admin: Hard Delete Property](#610-admin-hard-delete-property)

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
POST http://localhost:3000/auth/register
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

### 2.6 Change Password

### `PATCH /auth/change-password`

Changes the authenticated user's password. **JWT required.**  
The new password **cannot** be the same as the current password.

**Request:**

```
PATCH http://localhost:3000/auth/change-password
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "current_password": "CurrentPass123!",
  "new_password": "NewPass456!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "message": "Password changed successfully. Please log in again."
  }
}
```

**Error — Current password incorrect (401):**

```json
{
  "success": false,
  "message": "Current password is incorrect",
  "error_code": 1108,
  "data": null
}
```

**Error — New password same as current (400):**

```json
{
  "success": false,
  "message": "New password cannot be the same as the current password",
  "error_code": 1109,
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
  "message": "current_password should not be empty; new_password must be longer than or equal to 8 characters",
  "error_code": 1001,
  "data": {
    "errors": [
      "current_password should not be empty",
      "new_password must be longer than or equal to 8 characters"
    ]
  }
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

## 6. Properties

> Public read endpoints (`GET /properties`, `GET /properties/:id`) require **no authentication**.
> Authenticated user endpoints require a valid **JWT** token (the property owner).
> Admin endpoints require a valid **JWT** and the `manage_properties` permission.

| Permission Required | Endpoints |
|---|---|
| `manage_properties` | `GET /properties/admin`, `PATCH /properties/:id/admin`, `DELETE /properties/:id/admin` |

---

### 6.1 List Properties

### `GET /properties`

Returns a paginated list of active property listings with optional filters and proximity search. No authentication required.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `city` | string | No | Filter by city name (via area relation) |
| `area_id` | string (UUID) | No | Filter by specific area |
| `type` | `residential`, `commercial`, `land`, `parking` | No | Property type filter |
| `listing_type` | `sale`, `rent` | No | Listing type filter |
| `min_price` | number | No | Minimum price |
| `max_price` | number | No | Maximum price |
| `min_area` | number | No | Minimum area size |
| `max_area` | number | No | Maximum area size |
| `bedrooms` | number | No | Filter by bedrooms (amenities JSONB) |
| `bathrooms` | number | No | Filter by bathrooms (amenities JSONB) |
| `search` | string | No | Case-insensitive search on title/description |
| `is_verified` | boolean | No | Filter by verification status |
| `sort_by` | `price_asc`, `price_desc`, `created_at_asc`, `created_at_desc`, `view_count_desc` | No | Sort order (default: `created_at_desc`) |
| `lat` | number | No | Latitude for proximity search |
| `lng` | number | No | Longitude for proximity search |
| `radius` | number | No | Search radius in km (max: 50, requires `lat` & `lng`) |
| `page` | number | No | Page number (default: 1, min: 1) |
| `limit` | number | No | Items per page (default: 20, min: 1, max: 100) |

**Request:**

```
GET http://localhost:3000/properties?page=1&limit=20
```

**Request with filters:**

```
GET http://localhost:3000/properties?type=residential&listing_type=sale&min_price=1000000&max_price=50000000&city=Dhaka
```

**Request with proximity search:**

```
GET http://localhost:3000/properties?lat=23.7873&lng=90.4100&radius=5&sort_by=price_asc
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid-of-property",
        "user_id": "uuid-of-user",
        "area_id": "uuid-of-area",
        "title": "Luxury 4BR Apartment in Gulshan-1",
        "description": "Beautiful 4-bedroom apartment with panoramic city view...",
        "type": "residential",
        "subtype": null,
        "listing_type": "sale",
        "price": 25000000,
        "price_currency": "BDT",
        "area_size": 2200,
        "area_unit": "sqft",
        "location_lat": 23.7873,
        "location_lng": 90.41,
        "address": "Road 68, Gulshan-1, Dhaka",
        "amenities": {
          "bedrooms": 4,
          "bathrooms": 4,
          "flooring": "tiles",
          "security": "24/7",
          "parking": "covered"
        },
        "status": "active",
        "is_verified": true,
        "virtual_tour_url": null,
        "view_count": 42,
        "published_at": "2026-07-06T10:00:00.000Z",
        "created_at": "2026-07-06T10:00:00.000Z",
        "updated_at": "2026-07-06T10:00:00.000Z",
        "area": {
          "id": "uuid-of-area",
          "name": "Gulshan-1",
          "city": "Dhaka"
        },
        "user": {
          "id": "uuid-of-user",
          "full_name": "John Doe",
          "avatar_url": null
        },
        "media": [
          {
            "id": "uuid-of-media",
            "url": "https://example.com/photo.jpg",
            "thumbnail_url": "https://example.com/thumb.jpg"
          }
        ],
        "_count": {
          "media": 5
        }
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

---

### 6.2 Get Property

### `GET /properties/:id`

Returns detailed information for a single active property listing. Increments the view count. No authentication required.

**Request:**

```
GET http://localhost:3000/properties/uuid-of-property
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "user_id": "uuid-of-user",
    "area_id": "uuid-of-area",
    "title": "Luxury 4BR Apartment in Gulshan-1",
    "description": "Beautiful 4-bedroom apartment with panoramic city view...",
    "type": "residential",
    "subtype": null,
    "listing_type": "sale",
    "price": 25000000,
    "price_currency": "BDT",
    "area_size": 2200,
    "area_unit": "sqft",
    "location_lat": 23.7873,
    "location_lng": 90.41,
    "address": "Road 68, Gulshan-1, Dhaka",
    "amenities": {
      "bedrooms": 4,
      "bathrooms": 4,
      "flooring": "tiles",
      "security": "24/7",
      "parking": "covered"
    },
    "status": "active",
    "is_verified": true,
    "virtual_tour_url": null,
    "view_count": 43,
    "published_at": "2026-07-06T10:00:00.000Z",
    "created_at": "2026-07-06T10:00:00.000Z",
    "updated_at": "2026-07-06T10:00:00.000Z",
    "area": {
      "id": "uuid-of-area",
      "name": "Gulshan-1",
      "city": "Dhaka",
      "parent": {
        "id": "uuid-of-parent-area",
        "name": "Gulshan"
      }
    },
    "user": {
      "id": "uuid-of-user",
      "full_name": "John Doe",
      "avatar_url": null,
      "auth_identities": [
        {
          "email": "john@example.com",
          "phone": null
        }
      ]
    },
    "media": [
      {
        "id": "uuid-of-media-1",
        "media_type": "image",
        "url": "https://example.com/photo1.jpg",
        "thumbnail_url": "https://example.com/thumb1.jpg",
        "display_order": 0
      },
      {
        "id": "uuid-of-media-2",
        "media_type": "image",
        "url": "https://example.com/photo2.jpg",
        "thumbnail_url": "https://example.com/thumb2.jpg",
        "display_order": 1
      }
    ],
    "_count": {
      "media": 5
    }
  }
}
```

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

### 6.3 Create Property

### `POST /properties`

Creates a new property listing in `draft` status. **JWT required.**

**Request:**

```
POST http://localhost:3000/properties
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "area_id": "uuid-of-area",
  "title": "Modern 3BR Apartment in Banani",
  "description": "A beautiful apartment in the heart of Banani.",
  "type": "residential",
  "subtype": "apartment",
  "listing_type": "rent",
  "price": 85000,
  "price_currency": "BDT",
  "area_size": 1650,
  "area_unit": "sqft",
  "location_lat": 23.793,
  "location_lng": 90.405,
  "address": "Road 11, Banani, Dhaka",
  "amenities": {
    "bedrooms": 3,
    "bathrooms": 3,
    "flooring": "tiles",
    "water_supply": "yes",
    "gas_connection": "yes",
    "electricity": "yes"
  },
  "virtual_tour_url": "https://tour.example.com/property-123"
}
```

**Required fields:** `area_id`, `title`, `type`, `listing_type`, `price`.

**Optional fields:** `description`, `subtype`, `price_currency` (default: `"BDT"`), `area_size`, `area_unit` (default: `"sqft"`), `location_lat`, `location_lng`, `address`, `amenities` (JSON object), `virtual_tour_url`.

**Response (201):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-new-property",
    "user_id": "uuid-of-user",
    "area_id": "uuid-of-area",
    "title": "Modern 3BR Apartment in Banani",
    "description": "A beautiful apartment in the heart of Banani.",
    "type": "residential",
    "subtype": "apartment",
    "listing_type": "rent",
    "price": 85000,
    "price_currency": "BDT",
    "area_size": 1650,
    "area_unit": "sqft",
    "location_lat": 23.793,
    "location_lng": 90.405,
    "address": "Road 11, Banani, Dhaka",
    "amenities": {
      "bedrooms": 3,
      "bathrooms": 3,
      "flooring": "tiles",
      "water_supply": "yes",
      "gas_connection": "yes",
      "electricity": "yes"
    },
    "status": "draft",
    "is_verified": false,
    "virtual_tour_url": "https://tour.example.com/property-123",
    "view_count": 0,
    "published_at": null,
    "created_at": "2026-07-07T10:00:00.000Z",
    "updated_at": "2026-07-07T10:00:00.000Z"
  }
}
```

**Error — Area not found (404):**

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

**Error — Invalid amenities (400):**

```json
{
  "success": false,
  "message": "Invalid amenities structure for the specified property type",
  "error_code": 1503,
  "data": null
}
```

**Error — Validation failure (400):**

```json
{
  "success": false,
  "message": "title should not be empty; price must not be less than 0",
  "error_code": 1001,
  "data": {
    "errors": ["title should not be empty", "price must not be less than 0"]
  }
}
```

---

### 6.4 Update Property

### `PATCH /properties/:id`

Updates the authenticated user's own property. All fields are optional. **JWT required.**

**Request:**

```
PATCH http://localhost:3000/properties/uuid-of-property
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "title": "Updated Title - Now With Better Description",
  "price": 95000,
  "status": "active"
}
```

> Note: The `status` field is only applied when the request is made by an admin. Non-admin users cannot change the status via this endpoint.

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "user_id": "uuid-of-user",
    "area_id": "uuid-of-area",
    "title": "Updated Title - Now With Better Description",
    "description": "A beautiful apartment in the heart of Banani.",
    "type": "residential",
    "subtype": "apartment",
    "listing_type": "rent",
    "price": 95000,
    "price_currency": "BDT",
    "area_size": 1650,
    "area_unit": "sqft",
    "location_lat": 23.793,
    "location_lng": 90.405,
    "address": "Road 11, Banani, Dhaka",
    "amenities": {
      "bedrooms": 3,
      "bathrooms": 3
    },
    "status": "draft",
    "is_verified": false,
    "virtual_tour_url": null,
    "view_count": 0,
    "published_at": null,
    "created_at": "2026-07-07T10:00:00.000Z",
    "updated_at": "2026-07-07T11:00:00.000Z"
  }
}
```

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

**Error — Forbidden (403):**

```json
{
  "success": false,
  "message": "You do not have permission to update this property",
  "error_code": 1003,
  "data": null
}
```

---

### 6.5 Delete Property

### `DELETE /properties/:id`

Soft-deletes (archives) the authenticated user's own property. **JWT required.**

**Request:**

```
DELETE http://localhost:3000/properties/uuid-of-property
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "user_id": "uuid-of-user",
    "area_id": "uuid-of-area",
    "title": "Modern 3BR Apartment in Banani",
    "status": "archived",
    ...
  }
}
```

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

**Error — Forbidden (403):**

```json
{
  "success": false,
  "message": "You do not have permission to delete this property",
  "error_code": 1003,
  "data": null
}
```

---

### 6.6 Add Media

### `POST /properties/:id/media`

Adds a media item (image/video) to the authenticated user's property. **JWT required.**

**Request:**

```
POST http://localhost:3000/properties/uuid-of-property/media
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "property_id":"uuid-of-property",
  "media_type": "image",
  "url": "https://example.com/property-photo.jpg",
  "thumbnail_url": "https://example.com/property-thumb.jpg",
  "display_order": 5
}
```

**Optional fields:** `thumbnail_url`, `display_order` (defaults to appending at the end).

**Response (201):**

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-new-media",
    "property_id": "uuid-of-property",
    "media_type": "image",
    "url": "https://example.com/property-photo.jpg",
    "thumbnail_url": "https://example.com/property-thumb.jpg",
    "display_order": 5,
    "analysis": null,
    "created_at": "2026-07-07T10:00:00.000Z"
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

**Error — Forbidden (403):**

```json
{
  "success": false,
  "message": "You do not have permission to add media to this property",
  "error_code": 1003,
  "data": null
}
```

---

### 6.7 Remove Media

### `DELETE /properties/media/:mediaId`

Removes a media item from the authenticated user's property. **JWT required.**

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

**Error — Forbidden (403):**

```json
{
  "success": false,
  "message": "You do not have permission to remove this media",
  "error_code": 1003,
  "data": null
}
```

---

### 6.8 Admin: List All Properties

### `GET /properties/admin`

Returns all properties across all statuses (including draft, archived), with full admin-level details. Requires `manage_properties` permission.

**Request:**

```
GET http://localhost:3000/properties/admin
Authorization: Bearer <access_token>
```

**Query Parameters:** Same as [6.1 List Properties](#61-list-properties), plus the `status` filter works across all statuses (`draft`, `active`, `sold`, `archived`).

**Response (200):** Same paginated structure as 6.1, but includes all properties regardless of status, and each item includes full admin details:

- User email and phone (via `auth_identities`)

---

### 6.9 Admin: Update Property

### `PATCH /properties/:id/admin`

Updates any property. Admin can also change the `status` field. Requires `manage_properties` permission.

**Request:**

```
PATCH http://localhost:3000/properties/uuid-of-property/admin
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "title": "Admin Updated Title",
  "status": "active"
}
```

**Response (200):** Same shape as 6.4 Update Property.

---

### 6.10 Admin: Hard Delete Property

### `DELETE /properties/:id/admin`

Permanently deletes a property from the database. Requires `manage_properties` permission.

**Request:**

```
DELETE http://localhost:3000/properties/uuid-of-property/admin
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

**Error — Not found (404):**

```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
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
11. **List Properties** — View all active property listings via `GET /properties` (no auth needed)
12. **Get Property Details** — View a single property via `GET /properties/:id` (no auth needed)
13. **Create Property** — Create a new draft property via `POST /properties` (JWT required)
14. **Update Property** — Update your own property via `PATCH /properties/:id` (JWT required)
15. **Add Media** — Attach images/videos to your property via `POST /properties/:id/media` (JWT required)
16. **Submit Verification** — Submit a property for verification via `POST /properties/:id/verification` (JWT required)
17. **Delete Property** — Soft-delete your property via `DELETE /properties/:id` (JWT required)

> **For Roles & Permissions**, you'll need to insert roles/permissions directly into the database first (there's no seed data). Use raw SQL or a Prisma script to create roles and permissions before testing those endpoints.
>
> **For Areas**, seed data is available. Run `npm run seed:areas` to populate 31 Dhaka areas (10 top-level + 21 children). Read endpoints require no authentication. Write endpoints (create/update/delete) require a JWT with the `manage_areas` permission.
>
> **For Properties**, seed data is available. Run `npm run seed:properties` to populate 10 sample properties across Dhaka areas (Gulshan, Banani, Bashundhara, Dhanmondi, Uttara, Mirpur, Baridhara, Mohammadpur, Motijheel). Requires `seed:areas` to be run first. Read endpoints require no authentication. User endpoints require a JWT. Admin endpoints require the `manage_properties` permission.