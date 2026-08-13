# Homenet API — Complete Endpoint Testing Guide

> **Base URL:** `http://localhost:3000`
> **Swagger UI:** `http://localhost:3000/api/docs`
> **API Version Prefix:** `/v1/`

---

## Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Response Format](#response-format)
3. [Error Codes Reference](#error-codes-reference)
4. [Seed Data](#seed-data)
5. [1. Root](#1-root)
6. [2. Authentication](#2-authentication)
   - [2.1 Register](#21-register)
   - [2.2 Login](#22-login)
   - [2.3 Refresh Token](#23-refresh-token)
   - [2.4 Logout](#24-logout)
   - [2.5 Get Profile](#25-get-profile)
   - [2.6 Change Password](#26-change-password)
7. [3. Users](#3-users)
   - [3.1 List All Users](#31-list-all-users)
   - [3.2 Get User by ID](#32-get-user-by-id)
   - [3.3 Update User](#33-update-user)
   - [3.4 Delete User](#34-delete-user)
   - [3.5 Upload Avatar](#35-upload-avatar)
   - [3.6 Remove Avatar](#36-remove-avatar)
8. [4. Roles & Permissions](#4-roles--permissions)
   - [4.1 List All Roles](#41-list-all-roles)
   - [4.2 Get Role by ID](#42-get-role-by-id)
   - [4.3 Get User's Roles](#43-get-users-roles)
   - [4.4 Assign Role to User](#44-assign-role-to-user)
   - [4.5 Remove Role from User](#45-remove-role-from-user)
   - [4.6 Assign Permission to Role](#46-assign-permission-to-role)
   - [4.7 Remove Permission from Role](#47-remove-permission-from-role)
9. [5. Areas](#5-areas)
   - [5.1 List All Areas](#51-list-all-areas)
   - [5.2 Get Area by ID](#52-get-area-by-id)
   - [5.3 Get Area Children](#53-get-area-children)
   - [5.4 Create Area](#54-create-area)
   - [5.5 Update Area](#55-update-area)
   - [5.6 Delete Area](#56-delete-area)
10. [6. Properties](#6-properties)
    - [6.1 List Public Properties](#61-list-public-properties)
    - [6.2 Get Property by ID](#62-get-property-by-id)
    - [6.3 Create/Update Property (Upsert)](#63-createupdate-property-upsert)
    - [6.4 Update Property (Deprecated)](#64-update-property-deprecated)
    - [6.5 Delete Property (Soft Delete)](#65-delete-property-soft-delete)
    - [6.6 List My Properties](#66-list-my-properties)
    - [6.7 Add Media](#67-add-media)
    - [6.8 Remove Media](#68-remove-media)
    - [6.9 Submit for Verification](#69-submit-for-verification)
    - [6.10 Admin: List All Properties](#610-admin-list-all-properties)
    - [6.11 Admin: Update Property](#611-admin-update-property)
    - [6.12 Admin: Hard Delete Property](#612-admin-hard-delete-property)

---

## Prerequisites & Setup

### Starting the Server

```bash
npm run start:dev
```

This runs in watch mode — installs dependencies, runs Prisma migrations, and starts the dev server on `http://localhost:3000`.

### Running Seeds

```bash
npm run seed:areas       # Creates Dhaka areas hierarchy
npm run seed:roles       # Creates roles, permissions, and test users
npm run seed:properties  # Creates 10 sample properties
```

### Collecting Tokens for Testing

1. **Register** a new user via `POST /v1/auth/register` or use seeded users below.
2. Copy the `access_token` from the response.
3. Add header `Authorization: Bearer <access_token>` for authenticated requests.

---

## Response Format

### Success Response

All successful responses are wrapped in a standard envelope via `ResponseInterceptor`:

```json
{
  "success": true,
  "message": "OK",
  "data": { ... }
}
```

- `message` is typically `"OK"` unless a custom message is returned.
- `data` contains the actual payload — can be an object, array, or primitive.

### Error Response

All errors are formatted via `GlobalExceptionFilter`:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": 1001,
  "data": null
}
```

- `error_code` is a numeric code unique to each error (see [Error Codes Reference](#error-codes-reference)).
- `data` may sometimes contain additional details (e.g., validation error array).

### Validation Error (400)

When request body fails class-validator decorators:

```json
{
  "success": false,
  "message": "field1 must be a string; field2 should not be empty",
  "error_code": 1001,
  "data": {
    "errors": ["field1 must be a string", "field2 should not be empty"]
  }
}
```

### 401 Unauthorized (No Token / Expired Token)

When the `JwtAuthGuard` rejects the request:

```json
{
  "success": false,
  "message": "Access token is invalid or has expired",
  "error_code": 1106,
  "data": null
}
```

### 403 Forbidden (Missing Permissions)

When `PermissionsGuard` rejects the request:

```json
{
  "success": false,
  "message": "You do not have permission to perform this action",
  "error_code": 1003,
  "data": null
}
```

### 404 Not Found (General)

```json
{
  "success": false,
  "message": "The requested resource was not found",
  "error_code": 1002,
  "data": null
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "An unexpected internal server error occurred",
  "error_code": 1000,
  "data": null
}
```

---

## Error Codes Reference

### System / General (1000–1099)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1000 | INTERNAL_SERVER_ERROR | 500 | An unexpected internal server error occurred |
| 1001 | VALIDATION_FAILED | 400 | Request validation failed |
| 1002 | RESOURCE_NOT_FOUND | 404 | The requested resource was not found |
| 1003 | FORBIDDEN | 403 | You do not have permission to perform this action |

### Auth Module (1100–1199)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1100 | INVALID_CREDENTIALS | 401 | Invalid email or password |
| 1101 | EMAIL_ALREADY_EXISTS | 409 | An account with this email already exists |
| 1102 | PASSWORD_TOO_WEAK | 400 | Password does not meet strength requirements |
| 1103 | INVALID_REFRESH_TOKEN | 401 | Invalid refresh token |
| 1104 | REFRESH_TOKEN_EXPIRED | 401 | Refresh token has expired |
| 1105 | USER_IDENTITY_NOT_FOUND | 401 | User identity not found |
| 1106 | JWT_INVALID_OR_EXPIRED | 401 | Access token is invalid or has expired |
| 1107 | USER_NOT_FOUND_AUTH | 401 | Authenticated user no longer exists |
| 1108 | CURRENT_PASSWORD_INCORRECT | 401 | Current password is incorrect |
| 1109 | NEW_PASSWORD_SAME_AS_CURRENT | 400 | New password cannot be the same as the current password |

### User Module (1200–1299)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1200 | USER_NOT_FOUND | 404 | User not found |
| 1201 | USER_UPDATE_FAILED | 500 | Failed to update user profile |
| 1202 | USER_DELETE_FAILED | 500 | Failed to delete user |
| 1210 | AVATAR_INVALID_FILE_TYPE | 400 | Invalid file type. Allowed types: JPEG, PNG, WebP |
| 1211 | AVATAR_FILE_TOO_LARGE | 400 | File size exceeds the maximum allowed limit |
| 1212 | AVATAR_UPLOAD_FAILED | 500 | Failed to upload avatar |

### Role Module (1300–1399)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1300 | ROLE_NOT_FOUND | 404 | Role not found |
| 1301 | ROLE_ALREADY_ASSIGNED | 409 | Role is already assigned to this user |
| 1302 | PERMISSION_NOT_FOUND | 404 | Permission not found |
| 1303 | PERMISSION_ALREADY_ASSIGNED | 409 | Permission is already assigned to this role |
| 1304 | INSUFFICIENT_ROLE | 403 | You do not have the required role to access this resource |

### Area Module (1400–1499)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1400 | AREA_NOT_FOUND | 404 | Area not found |
| 1401 | AREA_ALREADY_EXISTS | 409 | An area with this name already exists in the specified city |
| 1402 | AREA_HAS_ACTIVE_LISTINGS | 400 | Cannot delete area with active property listings |

### Property Module (1500–1599)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1500 | PROPERTY_NOT_FOUND | 404 | Property not found |
| 1501 | PROPERTY_ACCESS_DENIED | 403 | You do not have permission to modify this property |
| 1502 | PROPERTY_MISSING_AREA | 400 | area_id is required for property creation |
| 1503 | PROPERTY_INVALID_AMENITIES | 400 | Invalid amenities structure for the specified property type |
| 1510 | MEDIA_NOT_FOUND | 404 | Media not found |
| 1511 | MEDIA_INVALID_FILE_TYPE | 400 | Invalid file type. Allowed types: JPEG, PNG, WebP (images), MP4, MOV (videos) |
| 1512 | MEDIA_FILE_TOO_LARGE | 400 | File size exceeds the maximum allowed limit |
| 1513 | MEDIA_LIMIT_REACHED | 400 | Media limit reached for this property |
| 1514 | MEDIA_UPLOAD_FAILED | 500 | Failed to upload media to storage |
| 1520 | PROPERTY_INVALID_STATUS_TRANSITION | 400 | Cannot transition property to the requested status |
| 1521 | PROPERTY_CANNOT_SUBMIT | 400 | Only draft properties can be submitted for review |
| 1522 | PROPERTY_CANNOT_ARCHIVE | 400 | Only active or sold properties can be archived |

---

## Seed Data

The role seed script (`npm run seed:roles`) creates the following:

### Predefined Users

| Name | Email | Password | Role |
|------|-------|----------|------|
| Swaron | `s@g.com` | `asdfghjk` | `buyer_seller` |
| Arman | `a@g.com` | `asdfghjk` | `admin` |

### Predefined Roles

| ID | Name |
|----|------|
| `role-buyer-001` | `buyer_seller` |
| `role-mod-001` | `moderator` |
| `role-admin-001` | `admin` |
| `role-superadmin-001` | `superadmin` |

### Predefined Permissions

| ID | Name | Assigned To |
|----|------|-------------|
| `perm-001` | `view_roles` | admin, buyer_seller |
| `perm-002` | `manage_roles` | admin |
| `perm-003` | `create_listing` | admin, buyer_seller |
| `perm-004` | `moderate_listing` | admin |
| `perm-005` | `manage_users` | admin |
| `perm-006` | `review_verification` | admin |
| `perm-007` | `manage_content` | admin |
| `perm-008` | `manage_areas` | admin, buyer_seller |
| `perm-009` | `manage_properties` | admin, buyer_seller |

### Predefined Areas

All areas are in **Dhaka**. Parent areas (top-level):
`Gulshan`, `Banani`, `Baridhara`, `Bashundhara`, `Dhanmondi`, `Mirpur`, `Uttara`, `Mohammadpur`, `Motijheel`, `Rampura`

Child areas:
- **Gulshan** → `Gulshan-1`, `Gulshan-2`
- **Mirpur** → `Mirpur-1`, `Mirpur-2`, `Mirpur-10`, `Mirpur-12`, `Mirpur-14`
- **Uttara** → `Sector-1` through `Sector-14`

### Area ID Reference

| Area | ID |
|------|----|
| Gulshan | `gulshan-dhaka` |
| Banani | `banani-dhaka` |
| Baridhara | `baridhara-dhaka` |
| Bashundhara | `bashundhara-dhaka` |
| Dhanmondi | `dhanmondi-dhaka` |
| Mirpur | `mirpur-dhaka` |
| Uttara | `uttara-dhaka` |
| Mohammadpur | `mohammadpur-dhaka` |
| Motijheel | `motijheel-dhaka` |
| Rampura | `rampura-dhaka` |
| Gulshan-1 | `gulshan-1-dhaka` |
| Gulshan-2 | `gulshan-2-dhaka` |
| Mirpur-1 | `mirpur-1-dhaka` |
| Mirpur-10 | `mirpur-10-dhaka` |
| Sector-1 | `uttara-sector-1-dhaka` |

---

## 1. Root

### `GET /`

Health-check endpoint. **No authentication required.**

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

### `POST /v1/auth/register`

Creates a new user account with a local (email/password) identity. **No authentication required.**

**Request:**
```
POST http://localhost:3000/v1/auth/register
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

**Field Validation:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `full_name` | string | Yes | 2–100 characters |
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Non-empty. Must pass strength validation |

---

**Response (201) — Success:**
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

---

**Error (409) — Email already exists:**
```json
{
  "success": false,
  "message": "An account with this email already exists",
  "error_code": 1101,
  "data": null
}
```

---

**Error (400) — Weak password:**
```json
{
  "success": false,
  "message": "Password does not meet strength requirements",
  "error_code": 1102,
  "data": null
}
```

---

**Error (400) — Validation failure (missing fields):**
```json
{
  "success": false,
  "message": "full_name must be longer than or equal to 2 characters; email must be an email; password should not be empty",
  "error_code": 1001,
  "data": {
    "errors": [
      "full_name must be longer than or equal to 2 characters",
      "email must be an email",
      "password should not be empty"
    ]
  }
}
```

---

### 2.2 Login

### `POST /v1/auth/login`

Authenticates with email and password, returns JWT access token + refresh token. **No authentication required.**

**Request:**
```
POST http://localhost:3000/v1/auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "email": "s@g.com",
  "password": "asdfghjk"
}
```

**Field Validation:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Non-empty |

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "new-uuid-refresh-token",
    "user": {
      "id": "uuid-of-user",
      "full_name": "Swaron",
      "email": "s@g.com",
      "avatar_url": null
    }
  }
}
```

---

**Error (401) — Invalid credentials:**
```json
{
  "success": false,
  "message": "Invalid email or password",
  "error_code": 1100,
  "data": null
}
```

---

**Error (400) — Validation failure:**
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

### 2.3 Refresh Token

### `POST /v1/auth/refresh`

Exchange a valid refresh token for a new token pair (rotation). **No authentication required.**

**Request:**
```
POST http://localhost:3000/v1/auth/refresh
Content-Type: application/json
```

**Body:**
```json
{
  "refresh_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Field Validation:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `refresh_token` | string | Yes | Non-empty UUID string |

---

**Response (200) — Success:**
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

The old refresh token is **rotated** (replaced) — the old one is no longer valid.

---

**Error (401) — Invalid refresh token:**
```json
{
  "success": false,
  "message": "Invalid refresh token",
  "error_code": 1103,
  "data": null
}
```

---

**Error (401) — Expired refresh token:**
```json
{
  "success": false,
  "message": "Refresh token has expired",
  "error_code": 1104,
  "data": null
}
```

> Refresh tokens expire after **7 days**.

---

**Error (400) — Validation failure:**
```json
{
  "success": false,
  "message": "refresh_token should not be empty",
  "error_code": 1001,
  "data": {
    "errors": ["refresh_token should not be empty"]
  }
}
```

---

### 2.4 Logout

### `POST /v1/auth/logout`

Revokes the provided refresh token. **JWT required.**

**Request:**
```
POST http://localhost:3000/v1/auth/logout
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "refresh_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

---

**Error (401) — No token / Invalid token:**
```json
{
  "success": false,
  "message": "Access token is invalid or has expired",
  "error_code": 1106,
  "data": null
}
```

---

### 2.5 Get Profile

### `GET /v1/auth/me`

Returns the currently authenticated user's profile. **JWT required.**

**Request:**
```
GET http://localhost:3000/v1/auth/me
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "Swaron",
    "avatar_url": null,
    "email": "s@g.com",
    "email_verified": false,
    "created_at": "2026-06-30T10:00:00.000Z"
  }
}
```

---

**Error (401) — No token / Invalid token:**
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

### `PATCH /v1/auth/change-password`

Changes the authenticated user's password. **JWT required.**
The new password **cannot** be the same as the current password. All refresh tokens are revoked after change (forces re-login).

**Request:**
```
PATCH http://localhost:3000/v1/auth/change-password
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

**Field Validation:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `current_password` | string | Yes | Min 1 character |
| `new_password` | string | Yes | 8–128 characters, must meet strength requirements |

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "message": "Password changed successfully. Please log in again."
  }
}
```

> Note: All existing refresh tokens for this user are revoked. The client must re-authenticate.

---

**Error (401) — Current password incorrect:**
```json
{
  "success": false,
  "message": "Current password is incorrect",
  "error_code": 1108,
  "data": null
}
```

---

**Error (400) — New password same as current:**
```json
{
  "success": false,
  "message": "New password cannot be the same as the current password",
  "error_code": 1109,
  "data": null
}
```

---

**Error (400) — Weak password:**
```json
{
  "success": false,
  "message": "Password does not meet strength requirements",
  "error_code": 1102,
  "data": null
}
```

---

**Error (400) — Validation failure:**
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

### 3.1 List All Users

### `GET /v1/users`

Returns all registered users with their identity details. **JWT required.**

**Request:**
```
GET http://localhost:3000/v1/users
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "user-swaron-001",
      "full_name": "Swaron",
      "avatar_url": null,
      "created_at": "2026-06-30T10:00:00.000Z",
      "updated_at": "2026-06-30T10:00:00.000Z",
      "auth_identities": [
        {
          "provider": "LOCAL",
          "email": "s@g.com",
          "phone": null,
          "verified_at": null
        }
      ]
    },
    {
      "id": "user-arman-001",
      "full_name": "Arman",
      "avatar_url": null,
      "created_at": "2026-06-30T10:00:00.000Z",
      "updated_at": "2026-06-30T10:00:00.000Z",
      "auth_identities": [
        {
          "provider": "LOCAL",
          "email": "a@g.com",
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

### `GET /v1/users/:id`

Returns a single user's details. **JWT required.**

**Request:**
```
GET http://localhost:3000/v1/users/user-swaron-001
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "user-swaron-001",
    "full_name": "Swaron",
    "avatar_url": null,
    "created_at": "2026-06-30T10:00:00.000Z",
    "updated_at": "2026-06-30T10:00:00.000Z",
    "auth_identities": [
      {
        "provider": "LOCAL",
        "email": "s@g.com",
        "phone": null,
        "verified_at": null
      }
    ]
  }
}
```

---

**Error (404) — User not found:**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

---

### 3.3 Update User

### `PATCH /v1/users/:id`

Updates a user's profile. **JWT required.**

**Request:**
```
PATCH http://localhost:3000/v1/users/user-swaron-001
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "full_name": "New Name"
}
```

**Field Validation:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `full_name` | string | No | 2–100 characters |

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "user-swaron-001",
    "full_name": "New Name",
    "avatar_url": null,
    "created_at": "2026-06-30T10:00:00.000Z",
    "updated_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (404) — User not found:**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

---

**Error (400) — Validation failure:**
```json
{
  "success": false,
  "message": "full_name must be longer than or equal to 2 characters",
  "error_code": 1001,
  "data": {
    "errors": ["full_name must be longer than or equal to 2 characters"]
  }
}
```

---

### 3.4 Delete User

### `DELETE /v1/users/:id`

Permanently deletes a user. **JWT required.**

**Request:**
```
DELETE http://localhost:3000/v1/users/user-swaron-001
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "message": "User with id 'user-swaron-001' has been deleted"
  }
}
```

---

**Error (404) — User not found:**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

---

### 3.5 Upload Avatar

### `POST /v1/users/avatar`

Uploads or replaces the authenticated user's avatar image. **JWT required.**

> **Phase 1 limitation:** Only the Cloudinary URL is stored, not the `public_id`. Old avatar files remain in Cloudinary when replaced. Manual cleanup may be needed.

**Request:**
```
POST http://localhost:3000/v1/users/avatar
Content-Type: multipart/form-data
Authorization: Bearer <access_token>
```

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image (JPEG, PNG, or WebP), max 10 MB |

---

**Response (201) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "Swaron",
    "avatar_url": "https://res.cloudinary.com/.../image/upload/v123/homenet/users/uuid/avatar/uuid.jpg",
    "created_at": "2026-06-30T10:00:00.000Z",
    "updated_at": "2026-07-13T12:00:00.000Z",
    "auth_identities": [
      {
        "provider": "LOCAL",
        "email": "s@g.com",
        "phone": null,
        "verified_at": null
      }
    ]
  }
}
```

---

**Error (400) — Invalid file type:**
```json
{
  "success": false,
  "message": "Invalid file type. Allowed types: JPEG, PNG, WebP",
  "error_code": 1210,
  "data": null
}
```

---

**Error (400) — File too large:**
```json
{
  "success": false,
  "message": "File size exceeds the maximum allowed limit",
  "error_code": 1211,
  "data": null
}
```

---

**Error (500) — Upload failed:**
```json
{
  "success": false,
  "message": "Failed to upload avatar",
  "error_code": 1212,
  "data": null
}
```

---

**Error (404) — User not found:**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

---

### 3.6 Remove Avatar

### `DELETE /v1/users/avatar`

Removes the authenticated user's avatar from Cloudinary and clears the `avatar_url`. **JWT required.**

**Request:**
```
DELETE http://localhost:3000/v1/users/avatar
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "Swaron",
    "avatar_url": null,
    "created_at": "2026-06-30T10:00:00.000Z",
    "updated_at": "2026-07-13T12:00:00.000Z",
    "auth_identities": [
      {
        "provider": "LOCAL",
        "email": "s@g.com",
        "phone": null,
        "verified_at": null
      }
    ]
  }
}
```

---

**Error (404) — No avatar found:**
```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

---

## 4. Roles & Permissions

> Role routes are permission-protected:
> - `GET` routes require `view_roles` permission.
> - `POST`/`DELETE` routes require `manage_roles` permission.
> - **Admin** role has all permissions. **Buyer** can view roles but cannot manage them.

### 4.1 List All Roles

### `GET /v1/roles`

Returns all roles with their assigned permissions. Requires `view_roles` permission. **JWT required.**

**Request:**
```
GET http://localhost:3000/v1/roles
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "role-buyer-001",
      "name": "buyer_seller",
      "role_permissions": [
        {
          "permission": {
            "id": "perm-003",
            "name": "create_listing"
          }
        },
        {
          "permission": {
            "id": "perm-008",
            "name": "manage_areas"
          }
        },
        {
          "permission": {
            "id": "perm-009",
            "name": "manage_properties"
          }
        }
      ]
    },
    {
      "id": "role-admin-001",
      "name": "admin",
      "role_permissions": [
        {
          "permission": {
            "id": "perm-001",
            "name": "view_roles"
          }
        },
        {
          "permission": {
            "id": "perm-002",
            "name": "manage_roles"
          }
        },
        "... (all 9 permissions)"
      ]
    }
  ]
}
```

---

**Error (403) — Missing `view_roles` permission:**
```json
{
  "success": false,
  "message": "You do not have permission to perform this action",
  "error_code": 1003,
  "data": null
}
```

---

### 4.2 Get Role by ID

### `GET /v1/roles/:id`

Returns a single role with its permissions. Requires `view_roles` permission. **JWT required.**

**Request:**
```
GET http://localhost:3000/v1/roles/role-buyer-001
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "role-buyer-001",
    "name": "buyer_seller",
    "role_permissions": [
      {
        "permission": {
          "id": "perm-003",
          "name": "create_listing"
        }
      },
      {
        "permission": {
          "id": "perm-008",
          "name": "manage_areas"
        }
      },
      {
        "permission": {
          "id": "perm-009",
          "name": "manage_properties"
        }
      }
    ]
  }
}
```

---

**Error (404) — Role not found:**
```json
{
  "success": false,
  "message": "Role not found",
  "error_code": 1300,
  "data": null
}
```

---

### 4.3 Get User's Roles

### `GET /v1/roles/user/:userId`

Returns all roles assigned to a specific user. Requires `view_roles` permission. **JWT required.**

**Request:**
```
GET http://localhost:3000/v1/roles/user/user-swaron-001
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "role-buyer-001",
      "name": "buyer_seller",
      "assigned_by": null,
      "created_at": "2026-06-30T10:00:00.000Z"
    }
  ]
}
```

---

**Error (404) — User not found (Prisma returns empty array, not an error):**
```json
{
  "success": true,
  "message": "OK",
  "data": []
}
```

---

### 4.4 Assign Role to User

### `POST /v1/roles/assign`

Assigns a role to a user. Requires `manage_roles` permission. **JWT required (Admin only).**

**Request:**
```
POST http://localhost:3000/v1/roles/assign
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "userId": "user-swaron-001",
  "roleId": "role-mod-001"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `userId` | string | Yes | Non-empty UUID |
| `roleId` | string | Yes | Non-empty UUID |

---

**Response (201) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user-role",
    "user_id": "user-swaron-001",
    "role_id": "role-mod-001",
    "created_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (409) — Role already assigned:**
```json
{
  "success": false,
  "message": "Role is already assigned to this user",
  "error_code": 1301,
  "data": null
}
```

---

**Error (403) — Missing `manage_roles` permission:**
```json
{
  "success": false,
  "message": "You do not have permission to perform this action",
  "error_code": 1003,
  "data": null
}
```

---

### 4.5 Remove Role from User

### `DELETE /v1/roles/revoke`

Removes a role from a user. Requires `manage_roles` permission. **JWT required (Admin only).**

**Request:**
```
DELETE http://localhost:3000/v1/roles/revoke
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "userId": "user-swaron-001",
  "roleId": "role-mod-001"
}
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-deleted-record",
    "user_id": "user-swaron-001",
    "role_id": "role-mod-001"
  }
}
```

---

**Error (404) — Role assignment not found:**
```json
{
  "success": false,
  "message": "Role not found",
  "error_code": 1300,
  "data": null
}
```

---

### 4.6 Assign Permission to Role

### `POST /v1/roles/:roleId/permissions`

Attaches a permission to a role. Requires `manage_roles` permission. **JWT required (Admin only).**

**Request:**
```
POST http://localhost:3000/v1/roles/role-buyer-001/permissions
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "permissionId": "perm-004"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `permissionId` | string | Yes | Non-empty UUID |

---

**Response (201) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-role-permission",
    "role_id": "role-buyer-001",
    "permission_id": "perm-004"
  }
}
```

---

**Error (409) — Permission already assigned:**
```json
{
  "success": false,
  "message": "Permission is already assigned to this role",
  "error_code": 1303,
  "data": null
}
```

---

**Error (404) — Role or Permission not found:**
```json
{
  "success": false,
  "message": "Role not found",
  "error_code": 1300,
  "data": null
}
```
```json
{
  "success": false,
  "message": "Permission not found",
  "error_code": 1302,
  "data": null
}
```

---

### 4.7 Remove Permission from Role

### `DELETE /v1/roles/:roleId/permissions/:permissionId`

Detaches a permission from a role. Requires `manage_roles` permission. **JWT required (Admin only).**

**Request:**
```
DELETE http://localhost:3000/v1/roles/role-buyer-001/permissions/perm-004
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-deleted-record",
    "role_id": "role-buyer-001",
    "permission_id": "perm-004"
  }
}
```

---

**Error (404) — Role permission not found:**
```json
{
  "success": false,
  "message": "Permission not found",
  "error_code": 1302,
  "data": null
}
```

---

## 5. Areas

Areas are hierarchically organized (parent/child). Public routes (`GET`) are **unauthenticated**. Admin routes (`POST`, `PATCH`, `DELETE`) require `manage_areas` permission.

Admin routes have stricter rate limiting: **10 requests/minute** (vs 60/minute for public routes).

### 5.1 List All Areas

### `GET /v1/areas`

Returns paginated list of areas. **No authentication required.**

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `city` | string | Filter by city |
| `parent_area_id` | string | Filter by parent area |
| `search` | string | Search by name (case-insensitive contains) |
| `page` | number (default: 1) | Page number (min: 1) |
| `limit` | number (default: 20) | Items per page (1–100) |

**Request:**
```
GET http://localhost:3000/v1/areas?city=Dhaka&page=1&limit=10
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "gulshan-dhaka",
        "name": "Gulshan",
        "parent_area_id": null,
        "city": "Dhaka",
        "created_at": "2026-07-05T10:00:00.000Z",
        "updated_at": "2026-07-05T10:00:00.000Z"
      },
      {
        "id": "banani-dhaka",
        "name": "Banani",
        "parent_area_id": null,
        "city": "Dhaka",
        "created_at": "2026-07-05T10:00:00.000Z",
        "updated_at": "2026-07-05T10:00:00.000Z"
      }
    ],
    "total": 31,
    "page": 1,
    "limit": 10,
    "total_pages": 4
  }
}
```

---

### 5.2 Get Area by ID

### `GET /v1/areas/:id`

Returns a single area. **No authentication required.**

**Request:**
```
GET http://localhost:3000/v1/areas/gulshan-dhaka
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "gulshan-dhaka",
    "name": "Gulshan",
    "parent_area_id": null,
    "city": "Dhaka",
    "created_at": "2026-07-05T10:00:00.000Z",
    "updated_at": "2026-07-05T10:00:00.000Z"
  }
}
```

---

**Error (404) — Area not found:**
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

### `GET /v1/areas/:id/children`

Returns child areas. **No authentication required.**

**Request:**
```
GET http://localhost:3000/v1/areas/gulshan-dhaka/children
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "gulshan-1-dhaka",
      "name": "Gulshan-1",
      "parent_area_id": "gulshan-dhaka",
      "city": "Dhaka",
      "created_at": "2026-07-05T10:00:00.000Z",
      "updated_at": "2026-07-05T10:00:00.000Z"
    },
    {
      "id": "gulshan-2-dhaka",
      "name": "Gulshan-2",
      "parent_area_id": "gulshan-dhaka",
      "city": "Dhaka",
      "created_at": "2026-07-05T10:00:00.000Z",
      "updated_at": "2026-07-05T10:00:00.000Z"
    }
  ]
}
```

---

**Error (404) — Parent area not found:**
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

### `POST /v1/areas`

Creates a new area. Requires `manage_areas` permission. **JWT required.**

**Request:**
```
POST http://localhost:3000/v1/areas
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "name": "New Area",
  "city": "Dhaka",
  "parent_area_id": "gulshan-dhaka"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1–255 characters |
| `city` | string | No | Default: `"Dhaka"` |
| `parent_area_id` | string (UUID) | No | Must reference an existing area |
| `boundary` | string | No | Geometry boundary (WKT or GeoJSON) |
| `centroid` | string | No | Geometry centroid (WKT or GeoJSON) |

---

**Response (201) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-new-area",
    "name": "New Area",
    "parent_area_id": "gulshan-dhaka",
    "city": "Dhaka",
    "created_at": "2026-07-27T12:00:00.000Z",
    "updated_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (409) — Area already exists:**
```json
{
  "success": false,
  "message": "An area with this name already exists in the specified city",
  "error_code": 1401,
  "data": null
}
```

---

**Error (400) — Validation failure:**
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

### `PATCH /v1/areas/:id`

Updates an existing area. Requires `manage_areas` permission. **JWT required.**

**Request:**
```
PATCH http://localhost:3000/v1/areas/gulshan-dhaka
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body (all fields optional):**
```json
{
  "name": "Updated Name"
}
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "gulshan-dhaka",
    "name": "Updated Name",
    "parent_area_id": null,
    "city": "Dhaka",
    "created_at": "2026-07-05T10:00:00.000Z",
    "updated_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (404) — Area not found:**
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

### `DELETE /v1/areas/:id`

Deletes an area. Requires `manage_areas` permission. **JWT required.**

**Request:**
```
DELETE http://localhost:3000/v1/areas/gulshan-dhaka
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": null
}
```

---

**Error (404) — Area not found:**
```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

---

**Error (400) — Area has active listings:**
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

> Property endpoints have mixed access levels:
> - **Public** (no auth): `GET /v1/properties`, `GET /v1/properties/:id`
> - **Authenticated** (JWT): `POST /v1/properties`, `PATCH /v1/properties/:id`, `DELETE /v1/properties/:id`, `POST /v1/properties/:id/submit`, `POST /v1/properties/:id/media`, `DELETE /v1/properties/media/:mediaId`, `GET /v1/properties/my`
> - **Admin** (JWT + `manage_properties`): `GET /v1/properties/admin`, `PATCH /v1/properties/:id/admin`, `DELETE /v1/properties/:id/admin`

Write endpoints have stricter rate limiting: **10 requests/minute**.

### 6.1 List Public Properties

### `GET /v1/properties`

Returns published (active) properties with pagination and filtering. **No authentication required.**

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `city` | string | Filter by city |
| `area_id` | string (UUID) | Filter by area |
| `type` | enum | `residential`, `commercial`, `land`, `parking` |
| `listing_type` | enum | `sale`, `rent` |
| `status` | enum | `draft`, `active`, `pending`, `sold`, `archived` |
| `min_price` | number | Minimum price |
| `max_price` | number | Maximum price |
| `min_area` | number | Minimum area size |
| `max_area` | number | Maximum area size |
| `bedrooms` | number | Number of bedrooms |
| `bathrooms` | number | Number of bathrooms |
| `search` | string | Full-text search |
| `is_verified` | boolean | Filter by verification status |
| `sort_by` | string | Sort field (e.g., `created_at_desc`, `price_asc`) |
| `page` | number (default: 1) | Page number |
| `limit` | number (default: 20) | Items per page (1–100) |
| `lat` | number | Latitude for proximity search |
| `lng` | number | Longitude for proximity search |
| `radius` | number | Search radius in km (1–50) |

**Request:**
```
GET http://localhost:3000/v1/properties?type=residential&listing_type=sale&page=1&limit=10
```

**Proximity Search:**
```
GET http://localhost:3000/v1/properties?lat=23.7800&lng=90.4100&radius=5
```

Uses Haversine formula with bounding box pre-filter. No PostGIS dependency.

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "user_id": "user-swaron-001",
        "area_id": "gulshan-dhaka",
        "title": "Beautiful Apartment in Gulshan",
        "description": "A well-furnished apartment...",
        "type": "residential",
        "subtype": "apartment",
        "listing_type": "sale",
        "price": 25000000,
        "price_currency": "BDT",
        "area_size": 1500,
        "area_unit": "sqft",
        "location_lat": 23.7800,
        "location_lng": 90.4100,
        "address": "123 Gulshan Avenue",
        "amenities": {
          "bedrooms": 3,
          "bathrooms": 2,
          "parking": true
        },
        "status": "active",
        "is_verified": false,
        "virtual_tour_url": null,
        "view_count": 42,
        "published_at": "2026-07-10T10:00:00.000Z",
        "created_at": "2026-07-10T10:00:00.000Z",
        "updated_at": "2026-07-15T12:00:00.000Z",
        "media": [
          {
            "id": "media-uuid",
            "url": "https://res.cloudinary.com/...",
            "media_type": "image",
            "display_order": 0
          }
        ],
        "area": {
          "id": "gulshan-dhaka",
          "name": "Gulshan",
          "city": "Dhaka"
        }
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 10,
    "total_pages": 1
  }
}
```

Results are **cached for 300 seconds**.

---

### 6.2 Get Property by ID

### `GET /v1/properties/:id`

Returns a single published property detail. **No authentication required.**

**Request:**
```
GET http://localhost:3000/v1/properties/uuid-of-property
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid",
    "user_id": "user-swaron-001",
    "area_id": "gulshan-dhaka",
    "title": "Beautiful Apartment in Gulshan",
    "description": "A well-furnished apartment...",
    "type": "residential",
    "subtype": "apartment",
    "listing_type": "sale",
    "price": 25000000,
    "price_currency": "BDT",
    "area_size": 1500,
    "area_unit": "sqft",
    "location_lat": 23.7800,
    "location_lng": 90.4100,
    "address": "123 Gulshan Avenue",
    "amenities": {
      "bedrooms": 3,
      "bathrooms": 2,
      "parking": true
    },
    "status": "active",
    "is_verified": false,
    "virtual_tour_url": null,
    "view_count": 43,
    "published_at": "2026-07-10T10:00:00.000Z",
    "created_at": "2026-07-10T10:00:00.000Z",
    "updated_at": "2026-07-15T12:00:00.000Z",
    "media": [
      {
        "id": "media-uuid",
        "url": "https://res.cloudinary.com/...",
        "media_type": "image",
        "display_order": 0
      }
    ],
    "area": {
      "id": "gulshan-dhaka",
      "name": "Gulshan",
      "city": "Dhaka"
    }
  }
}
```

> The `view_count` is **incremented** on each request. Result is **cached for 600 seconds**.

---

**Error (404) — Property not found or not active:**
```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

### 6.3 Create/Update Property (Upsert)

### `POST /v1/properties`

Creates a new property or updates an existing one if `property_id` is provided. **JWT required.**

**Rate limit:** 10 requests/minute.

**Request:**
```
POST http://localhost:3000/v1/properties
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body (Create — new property):**
```json
{
  "area_id": "gulshan-dhaka",
  "title": "My New Apartment",
  "description": "A beautiful apartment in Gulshan",
  "type": "residential",
  "subtype": "apartment",
  "listing_type": "sale",
  "price": 25000000,
  "price_currency": "BDT",
  "area_size": 1500,
  "area_unit": "sqft",
  "location_lat": 23.7800,
  "location_lng": 90.4100,
  "address": "123 Avenue, Gulshan",
  "amenities": {
    "bedrooms": 3,
    "bathrooms": 2,
    "parking": true
  }
}
```

**Body (Update — existing property):**
```json
{
  "property_id": "uuid-of-existing-property",
  "price": 26000000,
  "description": "Updated description"
}
```

**All field details:**

| Field | Type | Required (create) | Constraints |
|-------|------|-------------------|-------------|
| `property_id` | string (UUID) | No | Omit to create; include to update |
| `area_id` | string (UUID) | **Yes** (create) | Must reference an existing area |
| `title` | string | No | Max 255 characters, trimmed |
| `description` | string | No | Max 5000 characters |
| `type` | enum | No | `residential`, `commercial`, `land`, `parking`. Default: `residential` |
| `subtype` | string | No | Free-text sub-category |
| `listing_type` | enum | No | `sale`, `rent`. Default: `sale` |
| `price` | number | No | Min 0. Default: `0` |
| `price_currency` | string | No | Max 3 characters. Default: `BDT` |
| `area_size` | number | No | Min 0 |
| `area_unit` | string | No | e.g., `sqft`, `sqm`. Default: `sqft` |
| `location_lat` | number | No | |
| `location_lng` | number | No | |
| `address` | string | No | Max 500 characters |
| `amenities` | object | No | JSON object validated against property type |
| `virtual_tour_url` | string | No | Must be a valid URL |
| `status` | enum | No | `draft`, `active`, `pending`, `sold`, `archived`. Only honored for admin |

---

**Response (201) — Create Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-new-property",
    "user_id": "user-swaron-001",
    "area_id": "gulshan-dhaka",
    "title": "My New Apartment",
    "description": "A beautiful apartment in Gulshan",
    "type": "residential",
    "subtype": "apartment",
    "listing_type": "sale",
    "price": 25000000,
    "price_currency": "BDT",
    "area_size": 1500,
    "area_unit": "sqft",
    "location_lat": 23.78,
    "location_lng": 90.41,
    "address": "123 Avenue, Gulshan",
    "amenities": {
      "bedrooms": 3,
      "bathrooms": 2,
      "parking": true
    },
    "status": "pending",
    "is_verified": false,
    "virtual_tour_url": null,
    "view_count": 0,
    "published_at": null,
    "created_at": "2026-07-27T12:00:00.000Z",
    "updated_at": "2026-07-27T12:00:00.000Z"
  }
}
```

> Status auto-computed: `pending` if `title`, `type`, `listing_type`, `price` all present; otherwise `draft`.

---

**Response (200) — Update Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-existing-property",
    "user_id": "user-swaron-001",
    "area_id": "gulshan-dhaka",
    "title": "My New Apartment",
    "description": "Updated description",
    "type": "residential",
    "subtype": "apartment",
    "listing_type": "sale",
    "price": 26000000,
    "price_currency": "BDT",
    "area_size": 1500,
    "area_unit": "sqft",
    "location_lat": 23.78,
    "location_lng": 90.41,
    "address": "123 Avenue, Gulshan",
    "amenities": {
      "bedrooms": 3,
      "bathrooms": 2,
      "parking": true
    },
    "status": "pending",
    "is_verified": false,
    "virtual_tour_url": null,
    "view_count": 0,
    "published_at": null,
    "created_at": "2026-07-27T12:00:00.000Z",
    "updated_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (400) — Missing area_id on create:**
```json
{
  "success": false,
  "message": "area_id is required for property creation",
  "error_code": 1502,
  "data": null
}
```

---

**Error (400) — Invalid amenities:**
```json
{
  "success": false,
  "message": "Invalid amenities structure for the specified property type",
  "error_code": 1503,
  "data": null
}
```

---

**Error (404) — Area not found:**
```json
{
  "success": false,
  "message": "Area not found",
  "error_code": 1400,
  "data": null
}
```

---

**Error (404) — Property not found (update path):**
```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

**Error (403) — Not owner (update path):**
```json
{
  "success": false,
  "message": "You do not have permission to update this property",
  "error_code": 1003,
  "data": null
}
```

---

### 6.4 Update Property (Deprecated)

### `PATCH /v1/properties/:id`

**Deprecated.** Use `POST /v1/properties` with `property_id` in body instead. Kept for backward compatibility. **JWT required.**

Delegates to the same `upsert()` method internally.

**Request:**
```
PATCH http://localhost:3000/v1/properties/uuid-of-property
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "price": 30000000
}
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property"
  }
}
```

> Note: The PATCH endpoint returns only `{ "id": "uuid" }` in data, unlike the POST upsert which returns the full object.

---

**Error responses:** Same as [6.3 Create/Update Property](#63-createupdate-property-upsert) update path.

---

### 6.5 Delete Property (Soft Delete)

### `DELETE /v1/properties/:id`

Soft-deletes (archives) a property. **JWT required.** Only the owner can delete. Only `active` or `sold` properties can be archived.

**Rate limit:** 10 requests/minute.

**Request:**
```
DELETE http://localhost:3000/v1/properties/uuid-of-property
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "status": "archived",
    "updated_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (404) — Property not found:**
```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

**Error (403) — Not owner:**
```json
{
  "success": false,
  "message": "You do not have permission to delete this property",
  "error_code": 1003,
  "data": null
}
```

---

**Error (400) — Cannot archive (wrong status):**
```json
{
  "success": false,
  "message": "Only active or sold properties can be archived",
  "error_code": 1522,
  "data": null
}
```

> Properties with status `draft` or `pending` cannot be soft-deleted. They must first be updated to `active` or `sold`.

---

### 6.6 List My Properties

### `GET /v1/properties/my`

Returns the authenticated user's properties (all statuses). **JWT required.**

**Request:**
```
GET http://localhost:3000/v1/properties/my
Authorization: Bearer <access_token>
```

**Query Parameters:** Same as [6.1 List Public Properties](#61-list-public-properties).

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "user_id": "user-swaron-001",
        "area_id": "gulshan-dhaka",
        "title": "My New Apartment",
        "type": "residential",
        "listing_type": "sale",
        "price": 25000000,
        "status": "pending",
        "is_verified": false,
        "view_count": 0,
        "created_at": "2026-07-27T12:00:00.000Z",
        "updated_at": "2026-07-27T12:00:00.000Z",
        "media": [],
        "area": {
          "id": "gulshan-dhaka",
          "name": "Gulshan",
          "city": "Dhaka"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

---

### 6.7 Add Media

### `POST /v1/properties/:id/media`

Uploads an image or video file for a property. **JWT required.** Only the property owner can add media.

**Rate limit:** 10 requests/minute.

**Request:**
```
POST http://localhost:3000/v1/properties/uuid-of-property/media
Content-Type: multipart/form-data
Authorization: Bearer <access_token>
```

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image (JPEG, PNG, WebP) or Video (MP4, MOV) |
| `media_type` | string | Yes | `image` or `video` (Note: actual type detected from file MIME) |
| `display_order` | number | No | Order position (0-based). Auto-assigned if omitted |

**Media Limits:**

| Type | Max Files | Max Size |
|------|-----------|----------|
| Image | 20 per property | Configurable (default ~10 MB) |
| Video | 3 per property | Configurable (default ~50 MB) |

---

**Response (201) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "media-uuid",
    "property_id": "uuid-of-property",
    "media_type": "image",
    "url": "https://res.cloudinary.com/...",
    "public_id": "cloudinary-public-id",
    "thumbnail_url": null,
    "display_order": 0,
    "created_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (400) — Invalid file type:**
```json
{
  "success": false,
  "message": "Invalid file type. Allowed types: JPEG, PNG, WebP (images), MP4, MOV (videos)",
  "error_code": 1511,
  "data": null
}
```

---

**Error (400) — File too large:**
```json
{
  "success": false,
  "message": "File size exceeds the maximum allowed limit",
  "error_code": 1512,
  "data": null
}
```

---

**Error (400) — Media limit reached:**
```json
{
  "success": false,
  "message": "Media limit reached for this property",
  "error_code": 1513,
  "data": null
}
```

---

**Error (500) — Upload failed:**
```json
{
  "success": false,
  "message": "Failed to upload media to storage",
  "error_code": 1514,
  "data": null
}
```

---

**Error (404) — Property not found:**
```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

### 6.8 Remove Media

### `DELETE /v1/properties/media/:mediaId`

Removes a media file from a property. **JWT required.** Only the property owner can remove media.

**Rate limit:** 10 requests/minute.

**Request:**
```
DELETE http://localhost:3000/v1/properties/media/uuid-of-media
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": null
}
```

---

**Error (404) — Media not found:**
```json
{
  "success": false,
  "message": "Media not found",
  "error_code": 1510,
  "data": null
}
```

---

**Error (403) — Not owner:**
```json
{
  "success": false,
  "message": "You do not have permission to remove this media",
  "error_code": 1003,
  "data": null
}
```

---

### 6.9 Submit for Verification

### `POST /v1/properties/:id/submit`

Submits a pending property for verification. **JWT required.** Only the property owner can submit.

**Rate limit:** 10 requests/minute.

**Pre-requisites:**
1. Property status must be `pending` (all required fields present).
2. All required fields must be filled: `title`, `description`, `type`, `listing_type`, `price` (>0), `area_id`, `area_size` (>0), `area_unit`, `address`, `location_lat`, `location_lng`.
3. At least 1 media item must exist.

**Request:**
```
POST http://localhost:3000/v1/properties/uuid-of-property/submit
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:** None (empty).

---

**Response (202) — Accepted:**
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

> After this, a `Verification` record is created and a background task is enqueued. The `MockVerificationService` will asynchronously process the verification (2–5 second delay simulated).
> - If last hex char of property UUID is `0`–`7`: verified
> - If `8`: rejected — "Manual review required"
> - If `9` or others: rejected — "Document verification failed"

---

**Error (400) — Property not in pending status:**
```json
{
  "success": false,
  "message": "Only draft properties can be submitted for review",
  "error_code": 1521,
  "data": null
}
```

---

**Error (400) — Missing required fields:**
```json
{
  "success": false,
  "message": "Only draft properties can be submitted for review",
  "error_code": 1521,
  "data": {
    "details": "Missing required fields: description, area_size, address, location_lat, location_lng, media (at least 1 required)"
  }
}
```

---

**Error (404) — Property not found:**
```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

**Error (403) — Not owner:**
```json
{
  "success": false,
  "message": "You do not have permission to submit this property",
  "error_code": 1003,
  "data": null
}
```

---

### 6.10 Admin: List All Properties

### `GET /v1/properties/admin`

Returns ALL properties (all statuses, all users). Requires `manage_properties` permission. **JWT required (Admin).**

**Request:**
```
GET http://localhost:3000/v1/properties/admin
Authorization: Bearer <access_token>
```

**Query Parameters:** Same as [6.1 List Public Properties](#61-list-public-properties).

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "uuid",
        "user_id": "user-swaron-001",
        "title": "My New Apartment",
        "status": "pending",
        "is_verified": false,
        "created_at": "2026-07-27T12:00:00.000Z",
        "user": {
          "id": "user-swaron-001",
          "full_name": "Swaron"
        },
        "area": {
          "id": "gulshan-dhaka",
          "name": "Gulshan",
          "city": "Dhaka"
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

### 6.11 Admin: Update Property

### `PATCH /v1/properties/:id/admin`

Updates ANY property (bypasses ownership check). Requires `manage_properties` permission. **JWT required (Admin).**

**Rate limit:** 10 requests/minute.

**Request:**
```
PATCH http://localhost:3000/v1/properties/uuid-of-property/admin
Content-Type: application/json
Authorization: Bearer <access_token>
```

**Body:** Same as `UpsertPropertyDto`. Admin can directly set `status`:
```json
{
  "status": "active",
  "price": 30000000
}
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "status": "active",
    "price": 30000000,
    "updated_at": "2026-07-27T12:00:00.000Z"
  }
}
```

---

**Error (404) — Property not found:**
```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

### 6.12 Admin: Hard Delete Property

### `DELETE /v1/properties/:id/admin`

Permanently deletes a property from the database. Requires `manage_properties` permission. **JWT required (Admin).**

**Rate limit:** 10 requests/minute.

**Request:**
```
DELETE http://localhost:3000/v1/properties/uuid-of-property/admin
Authorization: Bearer <access_token>
```

---

**Response (200) — Success:**
```json
{
  "success": true,
  "message": "OK",
  "data": null
}
```

---

**Error (404) — Property not found:**
```json
{
  "success": false,
  "message": "Property not found",
  "error_code": 1500,
  "data": null
}
```

---

## Appendix A: Typical Testing Flow

### Complete Happy Path (End-to-End)

1. **Health check** → `GET /` → 200
2. **Register new user** → `POST /v1/auth/register` → 201 → Save `access_token` + `refresh_token`
3. **Get profile** → `GET /v1/auth/me` → 200
4. **List areas** → `GET /v1/areas` → 200 → Pick an `area_id`
5. **Create property** → `POST /v1/properties` (with area_id and all fields) → 201 → Save `property_id`
6. **Add media** → `POST /v1/properties/:id/media` (multipart) → 201
7. **Submit for verification** → `POST /v1/properties/:id/submit` → 202
8. **(Wait ~2–5s for mock verification)**
9. **Check property status** → `GET /v1/properties/:id` → 200 (`is_verified` may be `true`)
10. **Refresh token** → `POST /v1/auth/refresh` → 200
11. **Logout** → `POST /v1/auth/logout` → 200

### Admin Flow

1. **Login as admin** → `POST /v1/auth/login` (a@g.com / asdfghjk) → Save token
2. **List all properties (admin)** → `GET /v1/properties/admin` → 200
3. **Update any property** → `PATCH /v1/properties/:id/admin` (set `status: "active"`) → 200
4. **Assign role** → `POST /v1/roles/assign` → 201
5. **Hard delete** → `DELETE /v1/properties/:id/admin` → 200

### Error Scenario Flow

1. **Register with existing email** → `POST /v1/auth/register` (s@g.com) → 409
2. **Login with wrong password** → `POST /v1/auth/login` → 401
3. **Access without token** → `GET /v1/auth/me` → 401
4. **Access without permission** → `POST /v1/roles/assign` (as buyer) → 403
5. **Get non-existent resource** → `GET /v1/areas/nonexistent` → 404
6. **Create property without area** → `POST /v1/properties` (no area_id) → 400
7. **Submit draft property** → `POST /v1/properties/:id/submit` (status=draft) → 400

---

## Appendix B: Quick Reference — Authentication Tokens

| Token | Purpose | Expiry | Usage |
|-------|---------|--------|-------|
| `access_token` | JWT Bearer token for API auth | Configurable (JWT expiry) | `Authorization: Bearer <token>` |
| `refresh_token` | UUID for obtaining new token pair | 7 days | `POST /v1/auth/refresh` |

---

## Appendix C: Rate Limiting

| Scope | Limit | Applies To |
|-------|-------|------------|
| Default (controller-wide) | 60 requests/minute | Public GET endpoints |
| Write endpoints | 10 requests/minute | All POST/PATCH/DELETE on properties |
| Area admin endpoints | 10 requests/minute | POST/PATCH/DELETE on areas |

---

## Appendix D: Caching

| Cache Key Pattern | TTL | Description |
|-------------------|-----|-------------|
| `properties:list:*` | 300s | Public property listings |
| `properties:detail:*` | 600s | Single property detail |
| `areas:list` | 300s | Area list |
| `areas:detail:*` | 300s | Single area detail |
| `areas:children:*` | 300s | Area children |
| `users:list` | 300s | User list |
| `users:profile:*` | 300s | User profile |
| `roles:list` | 300s | Role list |
| `roles:user:*` | 300s | User roles |
| `roles:permissions:*` | 300s | User permissions |
| `auth:profile:*` | 300s | Auth profile (GET /auth/me) |

Cache is invalidated on writes (create/update/delete operations).

---

## Appendix E: CORS Configuration

> **Status:** ⚠️ Not yet implemented in `src/main.ts`. Must be added before frontend integration.

The frontend runs on a Vite dev server (default `http://localhost:5173`) and needs to communicate with the API on `http://localhost:3000`. Cross-Origin Resource Sharing (CORS) must be configured on the backend to allow this.

### Allowed Origins

The following port ranges must be whitelisted to support multiple concurrent frontend/backend instances during development:

| Range | Purpose |
|-------|---------|
| `http://localhost:3000` – `http://localhost:3006` | API server instances (multiple dev / preview instances) |
| `http://localhost:5173` – `http://localhost:5176` | Vite frontend dev server instances |

### When adding CORS to `src/main.ts`

Place this **before** `app.listen(...)`:

```typescript
app.enableCors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

> Setting `credentials: true` is required because the frontend sends JWT Bearer tokens in the `Authorization` header. The `OPTIONS` method is needed for CORS preflight requests.

### What happens without CORS?

If CORS is not configured, the browser blocks frontend requests from `localhost:5173` to the API with an error like:

```
Access to fetch at 'http://localhost:3000/v1/auth/login' from origin 'http://localhost:5173'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```
