# Role‑Based Access Control (RBAC)

The Homenet API implements **permission‑based RBAC**.  Permissions are the atomic access units; roles are just collections of permissions.  This model enables fine‑grained control while keeping role management simple.

## Core Concepts
- **Permission** – a string identifier (e.g. `manage_roles`, `view_users`). Stored in the `Permission` table in `prisma/schema.prisma` and referenced throughout the code.
- **Role** – groups a set of permissions. Users are assigned one or more roles.
- **@Permissions() Decorator** – attaches required permission(s) to a controller route. See `src/common/decorators/permissions.decorator.ts`.
- **PermissionsGuard** – a global `APP_GUARD` that reads the decorator metadata and checks the current user’s effective permissions via a single Prisma query.  Implemented in `src/modules/role/guards/permissions.guard.ts`.

## How It Works
1. The request passes through **JwtAuthGuard** first, populating `request.user` with the authenticated user ID.
2. `PermissionsGuard` extracts the required permissions from metadata (`PERMISSIONS_KEY`).
3. It runs a Prisma count query that joins `UserRole → Role → RolePermission → Permission` and verifies that the user has at least one of the required permissions.
4. If the count is > 0 the request proceeds; otherwise a **403 Forbidden** error is thrown (handled by the global exception filter).

## Example Usage
```ts
import { Permissions } from '../../common/decorators/permissions.decorator';

@Permissions('delete_user')
@Delete('users/:id')
removeUser(@Param('id') id: string) {
  // implementation …
}
```
- Multiple permissions can be supplied; the guard treats them as an **OR** – the user needs **any** one of them.

## Managing Roles & Permissions (API)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/roles` | List all roles with their permissions |
| `GET` | `/v1/roles/:id` | Retrieve a single role |
| `GET` | `/v1/roles/user/:userId` | Get roles assigned to a user |
| `POST` | `/v1/roles/assign` | Assign a role to a user (`AssignRoleDto`) |
| `DELETE` | `/v1/roles/revoke` | Remove a role from a user |
| `POST` | `/v1/roles/:roleId/permissions` | Attach a permission to a role (`AssignPermissionDto`) |
| `DELETE` | `/v1/roles/:roleId/permissions/:permissionId` | Detach a permission |

## Adding New Permissions
1. Insert a new row into the `Permission` table (via Prisma or the admin UI).
2. Optionally assign it to existing roles via the `POST /v1/roles/:roleId/permissions` endpoint.
3. Protect new routes with `@Permissions('new_permission')`.

## Database Model (Prisma)
```prisma
model Permission {
  id   String @id @default(uuid())
  name String @unique
  role_permissions RolePermission[]
}

model Role {
  id   String @id @default(uuid())
  name String @unique
  role_permissions RolePermission[]
  user_roles UserRole[]
}

model RolePermission {
  role_id       String
  permission_id String
  role          Role @relation(fields: [role_id], references: [id])
  permission    Permission @relation(fields: [permission_id], references: [id])
  @@id([role_id, permission_id])
}
```

---
**Key files**: `src/common/decorators/permissions.decorator.ts`, `src/modules/role/guards/permissions.guard.ts`, `src/modules/role/role.controller.ts`, `docs/rbac-guide.md`
