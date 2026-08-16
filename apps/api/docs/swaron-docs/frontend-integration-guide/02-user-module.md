# User Module — Frontend Integration Guide

> **Base URL:** `http://localhost:3000/v1/users`
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
>   "error_code": 1200,
>   "data": null
> }
> ```
>
> **Auth:** All endpoints in this module require `Authorization: Bearer <access_token>` header. Unauthenticated requests return **401 Unauthorized**.

---

## 1. GET /v1/users

> 🔒 **Requires `Authorization: Bearer <access_token>`**

List all users with their auth identities.

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns all users

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "uuid-of-user-1",
      "full_name": "John Doe",
      "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
      "created_at": "2026-07-28T10:00:00.000Z",
      "updated_at": "2026-07-28T12:00:00.000Z",
      "auth_identities": [
        {
          "provider": "LOCAL",
          "email": "john@example.com",
          "phone": null,
          "verified_at": null
        }
      ]
    },
    {
      "id": "uuid-of-user-2",
      "full_name": "Jane Smith",
      "avatar_url": null,
      "created_at": "2026-07-27T09:00:00.000Z",
      "updated_at": "2026-07-27T09:00:00.000Z",
      "auth_identities": [
        {
          "provider": "LOCAL",
          "email": "jane@example.com",
          "phone": null,
          "verified_at": "2026-07-27T09:30:00.000Z"
        }
      ]
    }
  ]
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

## 2. POST /v1/users/avatar

> 🔒 **Requires `Authorization: Bearer <access_token>`**

Upload or replace user avatar. If user already has an avatar, the old one is deleted first.

### Request Body

**Content-Type:** `multipart/form-data`

| Field  | Type   | Required | Description                          |
|--------|--------|----------|--------------------------------------|
| `file` | File   | Yes      | Image file (JPEG, PNG, or WebP only) |

**Constraints:**
- Allowed MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- Max file size: **10 MB**

### Possible Responses

#### ✅ 201 Created — Avatar uploaded successfully

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "John Doe",
    "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T14:00:00.000Z",
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

#### ❌ 400 Bad Request — Invalid file type

```json
{
  "success": false,
  "message": "Invalid file type. Allowed types: JPEG, PNG, WebP",
  "error_code": 1210,
  "data": null
}
```

#### ❌ 400 Bad Request — File too large

```json
{
  "success": false,
  "message": "File size exceeds the maximum allowed limit",
  "error_code": 1211,
  "data": null
}
```

#### ❌ 404 Not Found — User not found

```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
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

#### ❌ 500 Internal Server Error — Upload failed

```json
{
  "success": false,
  "message": "Failed to upload avatar",
  "error_code": 1212,
  "data": null
}
```

---

## 3. DELETE /v1/users/avatar

> 🔒 **Requires `Authorization: Bearer <access_token>`**

Remove the authenticated user's avatar. The Cloudinary file and database asset record are both deleted, and `avatar_url` is set to `null`.

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Avatar removed successfully

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "John Doe",
    "avatar_url": null,
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T14:30:00.000Z",
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

#### ❌ 404 Not Found — User not found

```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

#### ❌ 404 Not Found — No avatar asset found

```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

> **Note:** Both "user not found" and "no avatar asset found" scenarios return the same error code (1200) and message.

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

## 4. GET /v1/users/:id

> 🔒 **Requires `Authorization: Bearer <access_token>`**

Get a single user by their UUID.

### Parameters

| Parameter | Type   | Required | Description               |
|-----------|--------|----------|---------------------------|
| `id`      | string | Yes      | UUID of the user to fetch |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns the user profile

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "John Doe",
    "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T12:00:00.000Z",
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

#### ❌ 404 Not Found — User not found

```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
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

## 5. PATCH /v1/users/:id

> 🔒 **Requires `Authorization: Bearer <access_token>`**

Update a user's profile information. Currently only `full_name` is updatable.

### Parameters

| Parameter | Type   | Required | Description                |
|-----------|--------|----------|----------------------------|
| `id`      | string | Yes      | UUID of the user to update |

### Request Body

```json
{
  "full_name": "Jane Doe"
}
```

| Field       | Type   | Required | Constraints         |
|-------------|--------|----------|---------------------|
| `full_name` | string | No       | 2–100 characters    |

### Possible Responses

#### ✅ 200 OK — User updated successfully

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "Jane Doe",
    "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T14:00:00.000Z",
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

#### ❌ 404 Not Found — User not found

```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation error

```json
{
  "success": false,
  "message": "full_name must be longer than or equal to 2 characters",
  "error_code": 1001,
  "data": {
    "errors": [
      "full_name must be longer than or equal to 2 characters"
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

## 6. DELETE /v1/users/:id

> 🔒 **Requires `Authorization: Bearer <access_token>`**

Delete a user permanently.

### Parameters

| Parameter | Type   | Required | Description                |
|-----------|--------|----------|----------------------------|
| `id`      | string | Yes      | UUID of the user to delete |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — User deleted successfully

```json
{
  "success": true,
  "message": "User with id 'uuid-of-user' has been deleted",
  "data": null
}
```

#### ❌ 404 Not Found — User not found

```json
{
  "success": false,
  "message": "User not found",
  "error_code": 1200,
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

## Common Error Codes Reference (User)

| Code | Message                                              | HTTP Status |
|------|------------------------------------------------------|-------------|
| 1200 | User not found                                       | 404         |
| 1201 | Failed to update user profile                        | 500         |
| 1202 | Failed to delete user                                | 500         |
| 1210 | Invalid file type. Allowed types: JPEG, PNG, WebP    | 400         |
| 1211 | File size exceeds the maximum allowed limit          | 400         |
| 1212 | Failed to upload avatar                              | 500         |
| 1106 | Access token is invalid or has expired               | 401         |
| 1001 | Request validation failed                            | 400         |
