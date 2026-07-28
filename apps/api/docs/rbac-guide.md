# RBAC (Role-Based Access Control) Guide

## How to Protect an API Route

### 1. Use `@Permissions()` decorator

```ts
import { Permissions } from '../../common/decorators/permissions.decorator';

@Permissions('delete_user')
@Delete('users/:id')
removeUser() { ... }
```

You can pass multiple permissions (user needs **any** one of them):

```ts
@Permissions('delete_user', 'ban_user')
@Delete('users/:id')
removeUser() { ... }
```

### 2. Route is now protected

- If user lacks the required permission → returns **403 Forbidden**
- If user is not authenticated → returns **401 Unauthorized** (handled by `JwtAuthGuard` first)
- Guards run in order: Auth → Permissions → Rate Limit

### 3. Available endpoints for managing roles & permissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/roles` | List all roles with permissions |
| `GET` | `/v1/roles/:id` | Get a single role |
| `GET` | `/v1/roles/user/:userId` | Get roles assigned to a user |
| `POST` | `/v1/roles/assign` | Assign a role to a user |
| `DELETE` | `/v1/roles/revoke` | Remove a role from a user |
| `POST` | `/v1/roles/:roleId/permissions` | Attach a permission to a role |
| `DELETE` | `/v1/roles/:roleId/permissions/:permissionId` | Detach a permission from a role |

### 4. How it works

```
User ──has──> Role(s) ──has──> Permission(s)
```

- A user can have multiple roles
- A role can have multiple permissions
- `@Permissions('delete_user')` runs a **single DB query** checking if the user has any role linked to that permission
- Permissions are the source of truth — roles are just groups

### 5. Quick setup for new features

1. Create the permission in the DB via Prisma
2. Assign it to a role via `POST /v1/roles/:roleId/permissions`
3. Assign the role to a user via `POST /v1/roles/assign`
4. Protect the route with `@Permissions('permission_name')`

### 6. Permission names (convention)

Use `snake_case` action-based names:

- `create_post`, `edit_post`, `delete_post`
- `manage_users`, `ban_users`
- `view_analytics`
