# Homenet API - Automated Postman Test Suite

Comprehensive API testing and regression suite for the Homenet backend built with NestJS 11, Prisma ORM, and PostgreSQL.

---

## 1. Structure & Files

The testing suite consists of the following deliverables in the `postman/` directory:

| File | Purpose |
|---|---|
| [`homenet-api-tests.postman_collection.json`](file:///d:/Coding/Fazesoft%20Labs%20LTD/Homenet/Homenet_Dev_Branch/Homenet/apps/api/postman/homenet-api-tests.postman_collection.json) | Postman collection (v2.1 schema) containing **103 test requests** covering 100% of the API endpoints |
| [`homenet-environment.postman_environment.json`](file:///d:/Coding/Fazesoft%20Labs%20LTD/Homenet/Homenet_Dev_Branch/Homenet/apps/api/postman/homenet-environment.postman_environment.json) | Postman environment with dynamic variable placeholders, auth tokens, and pre-seeded credentials |
| [`README.md`](file:///d:/Coding/Fazesoft%20Labs%20LTD/Homenet/Homenet_Dev_Branch/Homenet/apps/api/postman/README.md) | Documentation, setup instructions, execution guide, and coverage matrix |

---

## 2. Prerequisites & Starting the Backend

### Database & Seed Data
Ensure PostgreSQL is running (or connected to your cloud Neon DB configured in `.env`).

Seed the database with default roles, permissions, areas, and users:
```bash
npm run seed:roles
npm run seed:areas
npm run seed:properties
```

The role seed creates two default users:
- **Admin**: `a@g.com` / `asdfghjk` (Assigned `admin` role with all permissions `perm-001` through `perm-009`)
- **Regular User**: `s@g.com` / `asdfghjk` (Assigned `buyer_seller` role with `create_listing`, `manage_areas`, `manage_properties`)

### Start the NestJS Application
```bash
npm run start:dev
```
The server will start at `http://localhost:3000` (Swagger docs available at `http://localhost:3000/api/docs`).

---

## 3. How to Import and Run in Postman

### Step 1: Import Files into Postman
1. Open Postman.
2. Click **Import** (top left).
3. Drag and drop or browse to:
   - `postman/homenet-api-tests.postman_collection.json`
   - `postman/homenet-environment.postman_environment.json`

### Step 2: Select the Environment
In the upper right corner environment dropdown, select:
**`Homenet Development Environment`**

### Step 3: Execute the Test Suite
You can execute tests individually or run the full collection using the **Collection Runner**:
1. Click on the collection name **Homenet API Automated Test Suite**.
2. Click **Run collection** (blue button).
3. Select all folders (or select specific folders to test).
4. Click **Run Homenet API Automated Test Suite**.

The initial setup requests (`00 - Setup & Health`) will automatically log in as Admin and Regular User and populate `adminAccessToken`, `userAccessToken`, and `accessToken` in your environment.

---

## 4. How to Run with Newman (CLI / CI/CD)

If Newman is installed globally (`npm install -g newman`):
```bash
newman run postman/homenet-api-tests.postman_collection.json \
  -e postman/homenet-environment.postman_environment.json \
  --reporters cli,json
```

Or using `npx`:
```bash
npx newman run postman/homenet-api-tests.postman_collection.json \
  -e postman/homenet-environment.postman_environment.json
```

---

## 5. Test Suite Architecture

The collection is modularized to mirror the NestJS domain modules:

```
Homenet API Automated Test Suite
├── 00 - Setup & Health
│   ├── Health Check (GET /)
│   ├── Admin Login (captures adminAccessToken)
│   └── Regular User Login (captures userAccessToken)
├── 01 - Authentication
│   ├── Register (Positive, Duplicates, Boundary Lengths, Weak Passwords, Missing Fields)
│   ├── Login (Positive, Wrong Password, Non-Existent User, Missing Fields)
│   ├── Refresh Token (Positive Token Rotation, Invalid Token, Reused Rotated Token)
│   ├── Profile / Me (Positive Profile Fetch, Missing Token, Malformed Token)
│   ├── Change Password (Positive, Wrong Current Pass, Same Pass, Weak Pass)
│   └── Logout (Positive Token Revocation, Missing Auth Header)
├── 02 - Users
│   ├── List All Users (Admin Positive, Unauthorized)
│   ├── Get User by ID (Valid UUID, Non-Existent User)
│   ├── Update User (Valid Full Name, Non-Existent User, Boundary Length, Extra Fields)
│   ├── User Avatar (Multipart Upload, Non-Existent Avatar Delete, Unauthorized)
│   └── Delete User (Positive Cascading Deletion, Non-Existent User)
├── 03 - Roles & Permissions
│   ├── List Roles (Admin Positive, Regular User Forbidden, Unauthorized)
│   ├── Get Role by ID (Admin Positive, Non-Existent Role)
│   ├── Get User Roles (Admin Positive, Regular User Forbidden)
│   ├── Assign / Revoke Role (Admin Positive, Duplicate Conflict, Regular User Forbidden)
│   └── Assign / Revoke Permission (Admin Positive, Regular User Forbidden)
├── 04 - Areas
│   ├── List Areas (Public Positive, Query Filters: search, city, pagination)
│   ├── Get Area by ID (Public Positive, Non-Existent Area)
│   ├── Get Area Children (Public Positive, Non-Existent Area)
│   ├── Create Area (Admin Positive, Duplicate City Conflict, Missing Fields)
│   ├── Update Area (Admin Positive, Non-Existent Area)
│   └── Delete Area (Admin Positive, Active Listings Blocker - 400 rejection)
├── 05 - Properties
│   ├── List Published Properties (Public Discovery, Filters: type, price, sort)
│   ├── Proximity Search (Lat/Lng/Radius Geospatial Calculation)
│   ├── Admin List All (Admin Positive, Regular User Forbidden)
│   ├── My Properties (User Positive, Unauthorized)
│   ├── Get Property by ID (Public Positive, Non-Existent Property 404)
│   ├── Create Property (Draft vs. Pending status computation, Missing Area, Invalid Enums)
│   ├── Update Property (Owner Positive, Cross-User Forbidden)
│   ├── Property Media (Multipart Upload, Non-Owner Forbidden, Non-Existent Media)
│   ├── Verification Flow (Owner Submit, Non-Owner Forbidden)
│   ├── Admin Status Override (Admin Positive, Regular User Forbidden)
│   └── Deletion (Owner Soft Delete / Archive, Admin Hard Delete)
├── 06 - End-to-End Regression Workflow
│   └── 9-Step Lifecycle (Register -> Profile -> Create Listing -> Admin Approve -> Discover -> Archive -> 404 Check -> Hard Delete -> Purge User)
└── 99 - Cleanup
    └── Verify Server State and Session Validity
```

---

## 6. Detailed Endpoint Coverage Matrix (100% API Coverage)

| # | HTTP Method | Endpoint | Auth | Required Permission | Positive Test | Negative Test | RBAC / Auth Test | Validation Test | Response Assertion |
|---|---|---|---|---|:---:|:---:|:---:|:---:|:---:|
| 1 | `GET` | `/` | Public | None | Yes | Yes | N/A | N/A | Status 200, `success: true`, message `OK`, `data: "Hello World!"` |
| 2 | `POST` | `/v1/auth/register` | Public | None | Yes | Yes | N/A | Yes | Status 201, token pair, user object, email match |
| 3 | `POST` | `/v1/auth/login` | Public | None | Yes | Yes | Yes | Yes | Status 200, access_token & refresh_token issued |
| 4 | `POST` | `/v1/auth/refresh` | Public | None | Yes | Yes | Yes | Yes | Status 200, rotates refresh token hash in DB |
| 5 | `POST` | `/v1/auth/logout` | JWT | None | Yes | Yes | Yes | Yes | Status 200, revokes token, message confirmation |
| 6 | `GET` | `/v1/auth/me` | JWT | None | Yes | Yes | Yes | N/A | Status 200, user id, email, full_name |
| 7 | `PATCH` | `/v1/auth/change-password` | JWT | None | Yes | Yes | Yes | Yes | Status 200, prevents same password or wrong pass |
| 8 | `GET` | `/v1/users` | JWT | None | Yes | Yes | Yes | N/A | Status 200, array of users, auth_identities included |
| 9 | `POST` | `/v1/users/avatar` | JWT | None | Yes | Yes | Yes | Yes | Status 201/400/500, file type/size validation |
| 10 | `DELETE` | `/v1/users/avatar` | JWT | None | Yes | Yes | Yes | N/A | Status 200, removes avatar URL and asset record |
| 11 | `GET` | `/v1/users/:id` | JWT | None | Yes | Yes | Yes | N/A | Status 200, profile match, 404 / null on missing |
| 12 | `PATCH` | `/v1/users/:id` | JWT | None | Yes | Yes | Yes | Yes | Status 200, full_name updated, forbidNonWhitelisted |
| 13 | `DELETE` | `/v1/users/:id` | JWT | None | Yes | Yes | Yes | N/A | Status 200, cascades identities and tokens |
| 14 | `GET` | `/v1/roles` | JWT | `view_roles` | Yes | Yes | Yes | N/A | Status 200 (Admin), 403 (Regular User) |
| 15 | `GET` | `/v1/roles/:id` | JWT | `view_roles` | Yes | Yes | Yes | N/A | Status 200 (Admin), role permissions included |
| 16 | `GET` | `/v1/roles/user/:userId` | JWT | `view_roles` | Yes | Yes | Yes | N/A | Status 200 (Admin), 403 (Regular User) |
| 17 | `POST` | `/v1/roles/assign` | JWT | `manage_roles` | Yes | Yes | Yes | Yes | Status 201 (Admin), 403 (Regular User), 409 (Duplicate) |
| 18 | `DELETE` | `/v1/roles/revoke` | JWT | `manage_roles` | Yes | Yes | Yes | Yes | Status 200, deleted count returned |
| 19 | `POST` | `/v1/roles/:roleId/permissions` | JWT | `manage_roles` | Yes | Yes | Yes | Yes | Status 201 (Admin), 403 (Regular User) |
| 20 | `DELETE` | `/v1/roles/:roleId/permissions/:permissionId` | JWT | `manage_roles` | Yes | Yes | Yes | N/A | Status 200 (Admin), 403 (Regular User) |
| 21 | `GET` | `/v1/areas` | Public | None | Yes | Yes | N/A | Yes | Status 200, items array, total, page, limit |
| 22 | `GET` | `/v1/areas/:id` | Public | None | Yes | Yes | N/A | N/A | Status 200, area detail, parent, children |
| 23 | `GET` | `/v1/areas/:id/children` | Public | None | Yes | Yes | N/A | N/A | Status 200, children array returned |
| 24 | `POST` | `/v1/areas` | JWT | `manage_areas` | Yes | Yes | Yes | Yes | Status 201 (Admin), 409 (Duplicate), 400 (Missing fields) |
| 25 | `PATCH` | `/v1/areas/:id` | JWT | `manage_areas` | Yes | Yes | Yes | Yes | Status 200 (Admin), 404 (Missing area) |
| 26 | `DELETE` | `/v1/areas/:id` | JWT | `manage_areas` | Yes | Yes | Yes | N/A | Status 200 (Clean area), 400 (Active listings blocker) |
| 27 | `GET` | `/v1/properties` | Public | None | Yes | Yes | N/A | Yes | Status 200, only active published properties |
| 28 | `GET` | `/v1/properties/admin` | JWT | `manage_properties` | Yes | Yes | Yes | Yes | Status 200 (Admin), 403 (Regular User) |
| 29 | `GET` | `/v1/properties/my` | JWT | None | Yes | Yes | Yes | Yes | Status 200, returns authenticated user listings |
| 30 | `GET` | `/v1/properties/:id` | Public | None | Yes | Yes | N/A | N/A | Status 200 (Active), 404 (Draft/Archived), increments views |
| 31 | `POST` | `/v1/properties` | JWT | None | Yes | Yes | Yes | Yes | Status 201, computes 'pending' or 'draft' status |
| 32 | `PATCH` | `/v1/properties/:id` | JWT | None | Yes | Yes | Yes | Yes | Status 200 (Owner), 403 (Cross-User modification) |
| 33 | `POST` | `/v1/properties/:id/submit` | JWT | None | Yes | Yes | Yes | N/A | Status 202, enqueues verification, 403 (Non-owner) |
| 34 | `DELETE` | `/v1/properties/:id` | JWT | None | Yes | Yes | Yes | N/A | Status 200 (Owner soft delete / archive) |
| 35 | `POST` | `/v1/properties/:id/media` | JWT | None | Yes | Yes | Yes | Yes | Status 201/200, 403 (Non-owner forbidden) |
| 36 | `DELETE` | `/v1/properties/media/:mediaId` | JWT | None | Yes | Yes | Yes | N/A | Status 200 (Owner), 404 (Media not found) |
| 37 | `PATCH` | `/v1/properties/:id/admin` | JWT | `manage_properties` | Yes | Yes | Yes | Yes | Status 200 (Admin status override), 403 (User) |
| 38 | `DELETE` | `/v1/properties/:id/admin` | JWT | `manage_properties` | Yes | Yes | Yes | N/A | Status 200 (Admin hard purge), 403 (User) |
