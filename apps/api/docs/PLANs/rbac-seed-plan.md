# RBAC Seed Plan — Roles, Permissions & Users

## Overview

This document outlines the roles, permissions, and seed users implemented in `prisma/seeds/roles-permissions.seed.ts`. The design follows a flat RBAC model where permissions are assigned directly to roles via a `RolePermission` junction table, and users are linked to roles through a `UserRole` junction table.

---

## Roles

| Role | ID | Purpose / Reasoning |
|---|---|---|
| `buyer_seller` | `role-buyer-001` | End-users who browse, create, and manage their own property listings. The primary consumer role. |
| `moderator` | `role-mod-001` | Trusted users who review listings and content for policy compliance. Staged for future moderation workflows. |
| `admin` | `role-admin-001` | Full system access — manages users, roles, content, areas, properties, and verifications. |
| `superadmin` | `role-superadmin-001` | Reserved for system-level configuration and auditing beyond standard admin scope. Staged for future use. |

---

## Permissions

| ID | Name | Description / Reasoning |
|---|---|---|
| `perm-001` | `view_roles` | View existing roles and their permission mappings. Needed by admins for RBAC management. |
| `perm-002` | `manage_roles` | Create, update, and delete roles and their permission assignments. Restricted to admin. |
| `perm-003` | `create_listing` | Create a new property listing. Core action for buyer/seller users. |
| `perm-004` | `moderate_listing` | Approve, reject, or flag listings. Needed for moderator workflow. |
| `perm-005` | `manage_users` | Manage user accounts — suspend, verify, update profiles. Admin-only. |
| `perm-006` | `review_verification` | Review and approve user verification documents. Admin/trusted role. |
| `perm-007` | `manage_content` | Manage site-wide content (blog posts, banners, static pages). Admin-only. |
| `perm-008` | `manage_areas` | Create and manage area/location hierarchy. Both admins and buyers need this to organize listings by location. |
| `perm-009` | `manage_properties` | Full CRUD on property listings (any user's). Admins need this for content moderation; buyers need it for their own listings. |

---

## Role ↔ Permission Matrix

| Permission | `buyer_seller` | `moderator` | `admin` | `superadmin` |
|---|---|---|---|---|
| `view_roles` | — | — | ✅ | — |
| `manage_roles` | — | — | ✅ | — |
| `create_listing` | ✅ | — | ✅ | — |
| `moderate_listing` | — | — | ✅ | — |
| `manage_users` | — | — | ✅ | — |
| `review_verification` | — | — | ✅ | — |
| `manage_content` | — | — | ✅ | — |
| `manage_areas` | ✅ | — | ✅ | — |
| `manage_properties` | ✅ | — | ✅ | — |

> **Note:** `moderator` and `superadmin` roles are seeded but currently have no permissions assigned. They are ready for future assignment as moderation and super-admin workflows are implemented.

---

## Seed Users

| Name | Email | Password | Role | Reasoning |
|---|---|---|---|---|
| Swaron | `s@g.com` | `asdfghjk` | `buyer_seller` | Standard platform user who can create listings and manage their own areas/properties. |
| Arman | `a@g.com` | `asdfghjk` | `admin` | Admin user with full system access for development, testing, and operational management. |

Both users share the same password (`asdfghjk`) for convenience during local development and testing. Passwords are hashed with bcrypt (12 rounds) in the seed script.

---

## Schema Reference

The implementation uses four Prisma models:

- **`Role`** — Defines a named role (`buyer_seller`, `admin`, etc.)
- **`Permission`** — Defines a named permission (`create_listing`, `manage_areas`, etc.)
- **`RolePermission`** — Junction table linking roles to permissions (many-to-many)
- **`UserRole`** — Junction table linking users to roles (many-to-many)

All `upsert` operations are used in the seed to make it safe to re-run without duplicating data.

---

## Future Considerations

- Add permission assignments for `moderator` when moderation features are built (`perm-004`, `perm-006`, `perm-007`).
- Add permission assignments for `superadmin` when system-level auditing/config is built.
- Consider introducing a `PermissionGroup` model if the permission list grows significantly.
- Guard routes and controller methods using NestJS guards that check these permissions via `@Permissions()` decorator.
