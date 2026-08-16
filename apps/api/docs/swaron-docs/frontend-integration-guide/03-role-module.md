# Role Module — Frontend Integration Guide

> **Base URL:** `http://localhost:3000/v1/roles`
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
>   "error_code": 1300,
>   "data": null
> }
> ```
>
> **Auth:** All endpoints require `Authorization: Bearer <access_token>` header.
>
> **Permission-based access:** Some endpoints require specific permissions. If the user lacks the required permission, they receive a **403 Forbidden** response.

---

## Pre-seeded Data Reference

After running `npm run seed:roles`, the following roles and permissions are available:

### Roles

| ID                | Name           |
|-------------------|----------------|
| `role-buyer-001`  | `buyer_seller` |
| `role-mod-001`    | `moderator`    |
| `role-admin-001`  | `admin`        |
| `role-superadmin-001` | `superadmin` |

### Permissions

| ID        | Name                    | Description |
|-----------|-------------------------|-------------|
| `perm-001`| `view_roles`            | View roles and permissions |
| `perm-002`| `manage_roles`          | Assign/revoke roles and permissions |
| `perm-003`| `create_listing`        | Create property listings |
| `perm-004`| `moderate_listing`      | Moderate listings |
| `perm-005`| `manage_users`          | Manage users |
| `perm-006`| `review_verification`   | Review verifications |
| `perm-007`| `manage_content`        | Manage content |
| `perm-008`| `manage_areas`          | Manage areas |
| `perm-009`| `manage_properties`     | Manage properties |

### Default Role Assignments

| User                  | Role          | Email    |
|-----------------------|---------------|----------|
| Swaron (`user-swaron-001`) | `buyer_seller` | s@g.com  |
| Arman (`user-admin-001`)   | `admin`        | a@g.com  |

**Admin role** (`role-admin-001`) has all 9 permissions assigned.
**Buyer/Seller role** (`role-buyer-001`) has: `create_listing`, `manage_areas`, `manage_properties`.

---

## 1. GET /v1/roles

> 🔒 **Requires `view_roles` permission**

List all roles with their associated permissions.

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns all roles

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "role-buyer-001",
      "name": "buyer_seller",
      "created_at": "2026-07-28T10:00:00.000Z",
      "updated_at": "2026-07-28T10:00:00.000Z",
      "role_permissions": [
        {
          "permission": {
            "id": "perm-003",
            "name": "create_listing",
            "description": null
          }
        },
        {
          "permission": {
            "id": "perm-008",
            "name": "manage_areas",
            "description": null
          }
        },
        {
          "permission": {
            "id": "perm-009",
            "name": "manage_properties",
            "description": null
          }
        }
      ]
    },
    {
      "id": "role-admin-001",
      "name": "admin",
      "created_at": "2026-07-28T10:00:00.000Z",
      "updated_at": "2026-07-28T10:00:00.000Z",
      "role_permissions": [
        {
          "permission": {
            "id": "perm-001",
            "name": "view_roles",
            "description": null
          }
        },
        {
          "permission": {
            "id": "perm-002",
            "name": "manage_roles",
            "description": null
          }
        }
      ]
    }
  ]
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

## 2. GET /v1/roles/:id

> 🔒 **Requires `view_roles` permission**

Get a single role by its UUID with its associated permissions.

### Parameters

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `id`      | string | Yes      | UUID of the role to fetch |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Returns the role with permissions

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "role-buyer-001",
    "name": "buyer_seller",
    "created_at": "2026-07-28T10:00:00.000Z",
    "updated_at": "2026-07-28T10:00:00.000Z",
    "role_permissions": [
      {
        "permission": {
          "id": "perm-003",
          "name": "create_listing",
          "description": null
        }
      },
      {
        "permission": {
          "id": "perm-008",
          "name": "manage_areas",
          "description": null
        }
      },
      {
        "permission": {
          "id": "perm-009",
          "name": "manage_properties",
          "description": null
        }
      }
    ]
  }
}
```

#### ✅ 200 OK — Role not found (returns null data)

```json
{
  "success": true,
  "message": "OK",
  "data": null
}
```

> **Note:** When a role ID does not exist, the API returns `200 OK` with `data: null` instead of a 404 error.

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

## 3. GET /v1/roles/user/:userId

> 🔒 **Requires `view_roles` permission**

Get all roles assigned to a specific user.

### Parameters

| Parameter | Type   | Required | Description                 |
|-----------|--------|----------|-----------------------------|
| `userId`  | string | Yes      | UUID of the user to look up |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — User has roles assigned

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "uuid-of-userrole",
      "user_id": "uuid-of-user",
      "role_id": "role-buyer-001",
      "role": {
        "id": "role-buyer-001",
        "name": "buyer_seller"
      }
    }
  ]
}
```

#### ✅ 200 OK — User has no roles

```json
{
  "success": true,
  "message": "OK",
  "data": []
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

## 4. POST /v1/roles/assign

> 🔒 **Requires `manage_roles` permission**

Assign a role to a user.

### Request Body

```json
{
  "userId": "uuid-of-user",
  "roleId": "role-buyer-001"
}
```

| Field    | Type   | Required | Description                    |
|----------|--------|----------|--------------------------------|
| `userId` | string | Yes      | UUID of the target user        |
| `roleId` | string | Yes      | UUID of the role to assign     |

### Possible Responses

#### ✅ 200 OK — Role assigned successfully

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-userrole"
  }
}
```

#### ❌ 409 Conflict — Role already assigned

```json
{
  "success": false,
  "message": "Role is already assigned to this user",
  "error_code": 1301,
  "data": null
}
```

#### ❌ 404 Not Found — Role or user not found (foreign key violation)

```json
{
  "success": false,
  "message": "Related Role record not found",
  "error_code": 5002,
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
  "message": "userId must be a string; roleId should not be empty",
  "error_code": 1001,
  "data": {
    "errors": [
      "userId must be a string",
      "roleId should not be empty"
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

## 5. DELETE /v1/roles/revoke

> 🔒 **Requires `manage_roles` permission**

Revoke a role from a user.

### Request Body

```json
{
  "userId": "uuid-of-user",
  "roleId": "role-buyer-001"
}
```

| Field    | Type   | Required | Description                    |
|----------|--------|----------|--------------------------------|
| `userId` | string | Yes      | UUID of the target user        |
| `roleId` | string | Yes      | UUID of the role to revoke     |

### Possible Responses

#### ✅ 200 OK — Role revoked successfully

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "count": 1
  }
}
```

#### ✅ 200 OK — No matching role assignment found (no-op)

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "count": 0
  }
}
```

> **Note:** If the user does not have the specified role, the API returns `count: 0` instead of an error.
> This is because `deleteMany` in Prisma does not throw when no records match.

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
  "message": "userId must be a string; roleId must be a string",
  "error_code": 1001,
  "data": {
    "errors": [
      "userId must be a string",
      "roleId must be a string"
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

## 6. POST /v1/roles/:roleId/permissions

> 🔒 **Requires `manage_roles` permission**

Assign a permission to a role.

### Parameters

| Parameter | Type   | Required | Description                 |
|-----------|--------|----------|-----------------------------|
| `roleId`  | string | Yes      | UUID of the role            |

### Request Body

```json
{
  "permissionId": "perm-001"
}
```

| Field          | Type   | Required | Description                       |
|----------------|--------|----------|-----------------------------------|
| `permissionId` | string | Yes      | UUID of the permission to assign  |

### Possible Responses

#### ✅ 200 OK — Permission assigned to role

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-rolepermission"
  }
}
```

#### ❌ 409 Conflict — Permission already assigned to this role

```json
{
  "success": false,
  "message": "Permission is already assigned to this role",
  "error_code": 1303,
  "data": null
}
```

#### ❌ 404 Not Found — Role or permission not found (foreign key violation)

```json
{
  "success": false,
  "message": "Related Role record not found",
  "error_code": 5002,
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
  "message": "permissionId must be a string",
  "error_code": 1001,
  "data": {
    "errors": [
      "permissionId must be a string"
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

## 7. DELETE /v1/roles/:roleId/permissions/:permissionId

> 🔒 **Requires `manage_roles` permission**

Remove a permission from a role.

### Parameters

| Parameter      | Type   | Required | Description                         |
|----------------|--------|----------|-------------------------------------|
| `roleId`       | string | Yes      | UUID of the role                    |
| `permissionId` | string | Yes      | UUID of the permission to remove    |

### Request Body

None.

### Possible Responses

#### ✅ 200 OK — Permission removed from role

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "count": 1
  }
}
```

#### ✅ 200 OK — No matching permission assignment found (no-op)

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "count": 0
  }
}
```

> **Note:** If the role does not have the specified permission, the API returns `count: 0` instead of an error.

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

## Permission-Based Access Summary

| Endpoint                                                    | Required Permission | Allowed for                 |
|-------------------------------------------------------------|---------------------|-----------------------------|
| `GET /v1/roles`                                             | `view_roles`        | Admin, any role with perm   |
| `GET /v1/roles/:id`                                         | `view_roles`        | Admin, any role with perm   |
| `GET /v1/roles/user/:userId`                                | `view_roles`        | Admin, any role with perm   |
| `POST /v1/roles/assign`                                     | `manage_roles`      | Admin only                  |
| `DELETE /v1/roles/revoke`                                   | `manage_roles`      | Admin only                  |
| `POST /v1/roles/:roleId/permissions`                        | `manage_roles`      | Admin only                  |
| `DELETE /v1/roles/:roleId/permissions/:permissionId`        | `manage_roles`      | Admin only                  |

## Common Error Codes Reference (Role)

| Code | Message                                                | HTTP Status |
|------|--------------------------------------------------------|-------------|
| 1300 | Role not found                                         | 404         |
| 1301 | Role is already assigned to this user                  | 409         |
| 1302 | Permission not found                                   | 404         |
| 1303 | Permission is already assigned to this role            | 409         |
| 1304 | You do not have the required role to access this resource | 403       |
| 1003 | Forbidden resource                                     | 403         |
| 5002 | Related record not found                               | 400         |
| 1106 | Access token is invalid or has expired                 | 401         |
| 1001 | Request validation failed                              | 400         |
