# Auth Module — Frontend Integration Guide

> **Base URL:** `http://localhost:3000/v1/auth`
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
>   "error_code": 1100,
>   "data": null
> }
> ```
>
> **Auth:** All endpoints marked with 🔒 require `Authorization: Bearer <access_token>` header. Unauthenticated requests to protected endpoints return **401 Unauthorized**.

---

## 1. POST /v1/auth/register

> **Public** — No auth required.

### Request Body

```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "password": "Password123"
}
```

| Field       | Type   | Required | Constraints                      |
|-------------|--------|----------|----------------------------------|
| `full_name` | string | Yes      | 2–100 characters                 |
| `email`     | string | Yes      | Valid email format               |
| `password`  | string | Yes      | 8–72 chars, at least 1 letter + 1 number, no spaces |

### Possible Responses

#### ✅ 201 Created — Registration successful

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

#### ❌ 400 Bad Request — Validation errors

**Case: Password too weak**
```json
{
  "success": false,
  "message": "Password must contain at least one number.",
  "error_code": 1102,
  "data": null
}
```

**Case: Invalid email format**
```json
{
  "success": false,
  "message": "email must be an email",
  "error_code": 1001,
  "data": {
    "errors": ["email must be an email"]
  }
}
```

**Case: Missing fields**
```json
{
  "success": false,
  "message": "full_name must be longer than or equal to 2 characters; password must be at least 8 characters long.",
  "error_code": 1001,
  "data": {
    "errors": [
      "full_name must be longer than or equal to 2 characters",
      "password must be at least 8 characters long"
    ]
  }
}
```

#### ❌ 409 Conflict — Email already exists

```json
{
  "success": false,
  "message": "An account with this email already exists",
  "error_code": 1101,
  "data": null
}
```

---

## 2. POST /v1/auth/login

> **Public** — No auth required.

### Request Body

```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

| Field      | Type   | Required | Constraints        |
|------------|--------|----------|--------------------|
| `email`    | string | Yes      | Valid email format |
| `password` | string | Yes      | Non-empty string   |

### Possible Responses

#### ✅ 200 OK — Login successful

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "user": {
      "id": "uuid-of-user",
      "full_name": "John Doe",
      "email": "john@example.com",
      "avatar_url": "https://res.cloudinary.com/.../avatar.jpg"
    }
  }
}
```

#### ❌ 401 Unauthorized — Invalid credentials

```json
{
  "success": false,
  "message": "Invalid email or password",
  "error_code": 1100,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "email must be an email",
  "error_code": 1001,
  "data": {
    "errors": ["email must be an email"]
  }
}
```

---

## 3. POST /v1/auth/refresh

> **Public** — No auth required.

### Request Body

```json
{
  "refresh_token": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

| Field           | Type   | Required | Description                  |
|-----------------|--------|----------|------------------------------|
| `refresh_token` | string | Yes      | The refresh token from login |

### Possible Responses

#### ✅ 200 OK — Tokens refreshed successfully

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "c3d4e5f6-a7b8-9012-cdef-123456789012"
  }
}
```

#### ❌ 401 Unauthorized — Invalid refresh token

```json
{
  "success": false,
  "message": "Invalid refresh token",
  "error_code": 1103,
  "data": null
}
```

#### ❌ 401 Unauthorized — Refresh token expired

```json
{
  "success": false,
  "message": "Refresh token has expired",
  "error_code": 1104,
  "data": null
}
```

#### ❌ 401 Unauthorized — User identity not found

```json
{
  "success": false,
  "message": "User identity not found",
  "error_code": 1105,
  "data": null
}
```

---

## 4. POST /v1/auth/logout

> 🔒 **Requires `Authorization: Bearer <access_token>`**

### Request Body

```json
{
  "refresh_token": "c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

| Field           | Type   | Required | Description                   |
|-----------------|--------|----------|-------------------------------|
| `refresh_token` | string | Yes      | The refresh token to revoke   |

### Possible Responses

#### ✅ 200 OK — Logged out successfully

```json
{
  "success": true,
  "message": "Logged out successfully",
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

## 5. GET /v1/auth/me

> 🔒 **Requires `Authorization: Bearer <access_token>`**

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — User profile

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-user",
    "full_name": "John Doe",
    "avatar_url": "https://res.cloudinary.com/.../avatar.jpg",
    "email": "john@example.com",
    "email_verified": false,
    "created_at": "2026-07-28T10:00:00.000Z"
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

#### ❌ 401 Unauthorized — Authenticated user no longer exists

```json
{
  "success": false,
  "message": "Authenticated user no longer exists",
  "error_code": 1107,
  "data": null
}
```

---

## 6. PATCH /v1/auth/change-password

> 🔒 **Requires `Authorization: Bearer <access_token>`**

### Request Body

```json
{
  "current_password": "CurrentPass123",
  "new_password": "NewSecurePass456"
}
```

| Field              | Type   | Required | Constraints                               |
|--------------------|--------|----------|-------------------------------------------|
| `current_password` | string | Yes      | At least 1 character                      |
| `new_password`     | string | Yes      | 8–128 chars, at least 1 letter + 1 number, no spaces, must differ from current |

### Possible Responses

#### ✅ 200 OK — Password changed successfully

```json
{
  "success": true,
  "message": "Password changed successfully. Please log in again.",
  "data": null
}
```

> ⚠️ **Important:** After successful change-password, ALL existing refresh tokens for this user are revoked. The user must log in again.

#### ❌ 401 Unauthorized — Current password incorrect

```json
{
  "success": false,
  "message": "Current password is incorrect",
  "error_code": 1108,
  "data": null
}
```

#### ❌ 400 Bad Request — New password same as current

```json
{
  "success": false,
  "message": "New password cannot be the same as the current password",
  "error_code": 1109,
  "data": null
}
```

#### ❌ 400 Bad Request — Password too weak

```json
{
  "success": false,
  "message": "Password must contain at least one letter.",
  "error_code": 1102,
  "data": null
}
```

#### ❌ 400 Bad Request — Validation errors

```json
{
  "success": false,
  "message": "current_password must be longer than or equal to 1 characters; new_password must be longer than or equal to 8 characters",
  "error_code": 1001,
  "data": {
    "errors": [
      "current_password must be longer than or equal to 1 characters",
      "new_password must be longer than or equal to 8 characters"
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

#### ❌ 401 Unauthorized — User identity not found

```json
{
  "success": false,
  "message": "User identity not found",
  "error_code": 1105,
  "data": null
}
```

---

## Auth Flow Summary for Frontend

```
1. REGISTER  → POST /v1/auth/register     → get { access_token, refresh_token, user }
2. LOGIN     → POST /v1/auth/login         → get { access_token, refresh_token, user }
3. AUTHENTICATE → Attach access_token to all 🔒 requests as: Authorization: Bearer <token>
4. REFRESH   → POST /v1/auth/refresh       → get new { access_token, refresh_token }
               (call when access_token expires — 401 response)
5. LOGOUT    → POST /v1/auth/logout        → revoke refresh_token
6. PROFILE   → GET  /v1/auth/me            → get user profile
7. CHANGE PWD→ PATCH /v1/auth/change-password → requires re-login
```

### Token Storage Recommendation

| Token          | Storage         | Notes                                     |
|----------------|-----------------|-------------------------------------------|
| `access_token` | Memory / HTTP-only (preferred) | Short-lived (configured via JWT expiry) |
| `refresh_token`| Secure HttpOnly cookie or localStorage | Used to get new access tokens          |

### Common Error Codes Reference (Auth)

| Code | Message                           | HTTP Status |
|------|-----------------------------------|-------------|
| 1100 | Invalid email or password         | 401         |
| 1101 | An account with this email already exists | 409    |
| 1102 | Password does not meet strength requirements | 400 |
| 1103 | Invalid refresh token             | 401         |
| 1104 | Refresh token has expired         | 401         |
| 1105 | User identity not found           | 401         |
| 1106 | Access token is invalid or has expired | 401      |
| 1107 | Authenticated user no longer exists | 401        |
| 1108 | Current password is incorrect     | 401         |
| 1109 | New password cannot be the same as the current password | 400 |
