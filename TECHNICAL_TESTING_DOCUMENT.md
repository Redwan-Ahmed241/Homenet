# Technical Testing Manual & Quality Assurance Specification: Homenet Backend API

**Document Version:** 2.0.0 (Revision of 1.0.0 — see §0 Revision Log)
**Target Environment:** Node.js 20+ / NestJS 11 / PostgreSQL (Prisma ORM) / In-Memory Cache
**Scope:** `apps/api` (All Modules, Services, Infrastructure, and Security Layers)

---

## 0. Revision Log (v1.0.0 → v2.0.0)

This revision was produced by re-verifying every claim in v1.0.0 directly against `apps/api/src` and correcting or removing anything that did not match the code. Summary of substantive changes:

| # | Change | Why |
|---|---|---|
| 1 | Fixed pipeline order in §1 — Guards run before route-level `ValidationPipe`, not in parallel | v1.0.0 diagram implied simultaneous execution; NestJS order is Middleware → Guards → Interceptors → Pipes → Handler |
| 2 | Added **BP-05**: malformed UUID path params cause an uncaught HTTP 500, not a clean 400/404 | Verified: no `ParseUUIDPipe` anywhere in the codebase, and `PrismaPropertyRepository.findById` has no `try/catch` or `handlePrismaError` wrapper, so a raw Prisma error reaches `GlobalExceptionFilter`'s unhandled-exception branch |
| 3 | Added **BP-06**: resubmitting a property for verification after it was already verified/rejected throws an uncaught HTTP 500 | Direct compound consequence of BP-02 + BP-03: `Verification.property_id` is `@unique` in the Prisma schema, and `submitForVerification` can be called a second time (status is still `'pending'`) which hits the unique constraint via an unwrapped `prisma.verification.create()` |
| 4 | Corrected verification total latency: **not** a fixed 3000ms | `PrototypeBackgroundTaskService` waits `delayMs` (default 3000ms) before calling `processVerification`, which itself calls `MockVerificationService.verify()` — that method adds its own internal `2000 + Math.random() * 3000` ms delay. Total wall-clock time before the DB write is **5000–8000ms**, not 3000ms |
| 5 | Downgraded SEC-03 and SEC-04 from "vulnerability" framing to "hardening recommendation," with load-test caveats — RPS/memory figures in v1.0.0 were illustrative, not measured | Auditor feedback: unverified numbers presented as fact reduce credibility of the document |
| 6 | Added missing `PATCH /v1/properties/:id` row to §3.5 catalog | Endpoint exists at `property.controller.ts:87` and was omitted from v1.0.0 despite being used in E2E-02 |
| 7 | Fixed SEC-TEST-05: the documented `.env.test` (`THROTTLE_LIMIT=100`) directly contradicted the test's "429 on request 11" assertion | Login has no route-level `@Throttle` override, so it falls through to the global default from `ThrottlerModule.forRootAsync` — which reads `THROTTLE_LIMIT`. Test now specifies the required override |
| 8 | Replaced every ambiguous "X or Y" expected result with one concrete, code-derived outcome | Grounded in `GlobalExceptionFilter.mapHttpStatusToErrorCode()` and DTO validation rules |
| 9 | Added §4.5 Test Fixtures & Bootstrap Sequence | v1.0.0 referenced seeded IDs (`role-admin-001`, `prop-A`) that cannot exist without a documented seeding procedure |
| 10 | Rewrote White Box scenarios to reference branch conditions instead of absolute line numbers | Line numbers in v1.0.0 (e.g., "line 220") did not match the file's actual `lineNumber` log metadata, proving they drift with every edit |
| 11 | Added explicit test coverage for BP-02 (the most severe defect in the document) to Unit/Integration/E2E sections — it previously had **no test asserting it** | E2E-02 in v1.0.0 stopped at "event logged," never asserting `property.status` |
| 12 | Added edge cases: resubmission after verification, self-referential area parent (unguarded), unsave on an archived property, refresh-token reuse-after-rotation (confirmed correctly blocked), concurrent upsert race | Business-logic corner cases absent from v1.0.0 |

---

## 1. System Architecture & Component Interaction

### 1.1 High-Level Architecture Diagram
```
                             [ Client Requests: Web / Mobile ]
                                            │
                                            ▼
                          [ Express + NestJS HTTP Pipeline ]
                                            │
                                            ▼
                              [ CORS & URL Rewrite Middleware ]
                              - Whitelisted Origins
                              - Strips /api prefix
                                            │
                                            ▼
                                   [ Global Guards ]
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
             [ JwtAuthGuard ]                             [ PermissionsGuard ]
             - Global by default                          - Dynamic DB count query
             - Skipped by @Public()                       - Evaluates @Permissions()
                                            │
                                            ▼
                                 [ ThrottlerGuard ]
                     - Default: THROTTLE_LIMIT req / THROTTLE_TTL ms
                     - Route-level override via @Throttle()
                                            │
                                            ▼
                         [ ValidationPipe (parameter binding) ]
                         - Whitelist: true
                         - ForbidNonWhitelisted: true
                         - Transform: true
                                            │
                                            ▼
                               [ Route Controllers & DTOs ]
                 (Auth, User, Role, Area, Property, Verification)
                                            │
                                            ▼
                                   [ Service Layer ]
                                            │
         ┌───────────────────┬──────────────┴──────┬──────────────────┬──────────────┐
         ▼                   ▼                     ▼                  ▼              ▼
[ LoggerService ]     [ ICacheService ]    [ Event Emitter ]  [ IUploadService ] [ BackgroundTask ]
- Winston 6 levels    - CacheManager       - EventEmitter2    - Cloudinary v2    - In-Memory
- File/func metadata  - TTL per tier       - Domain Events    - Stream Upload      setTimeout
         │                   │                     │                  │              │
         └───────────────────┼─────────────────────┴──────────────────┴──────────────┘
                             ▼
                  [ Prisma ORM / Repositories ]
                             │
                             ▼
               [ PostgreSQL Database Engine ]
```

> **Note on error paths:** repository methods are **not uniformly wrapped**. `create`/`update` calls on `Property`, `Area`, and `User` route through `handlePrismaError()` (translates Prisma `P2025`/`P2002`/`P2003` into `AppException`), but read methods like `findById` and secondary writes like `createVerification` do **not**. Any other Prisma error class (invalid UUID syntax, unmapped constraint codes) falls through to `GlobalExceptionFilter`'s catch-all branch, which returns **HTTP 500** unconditionally — this is the root mechanism behind BP-05 and BP-06 below.

### 1.2 Pipeline Execution Lifecycle
1. **Entry & Pre-Processing:**
   - CORS validation against explicit origin whitelist (`localhost:8081-8086`, LAN IPs `192.168.68.105:*`, and production domains `homenetbd.com`, `homenet-bd.com`).
   - Reverse-proxy rewrite middleware strips `/api` transparently if `/api/v1/*` is provided.
2. **Guards Evaluation Chain (runs before DTO validation/transformation):**
   - **`JwtAuthGuard`:** Executed first. Validates bearer token signature and expiration via `passport-jwt`. Attaches payload `{ id: sub, email }` to `req.user`. Skipped if handler or class has `@Public()`.
   - **`PermissionsGuard`:** Invoked if endpoint is decorated with `@Permissions(...)`. Queries database table `UserRole` joining `Role` -> `RolePermission` -> `Permission` for a matching permission string.
   - **`ThrottlerGuard`:** Enforces rate limits using in-memory tracker (`THROTTLE_LIMIT` requests per `THROTTLE_TTL` ms, default 10/60000ms if unset — see `app.module.ts`), or route-level overrides via `@Throttle()` (e.g., 60 req/min for public browse, 30 req/min for save/unsave).
3. **Parameter Binding & Business Execution:**
   - Global `ValidationPipe` strips non-whitelisted payload properties (`forbidNonWhitelisted: true`) and transforms primitive representations into DTO instances — this runs at parameter-binding time, immediately before the controller method executes, i.e. **after** guards.
   - Controller invokes modular Domain Service via Dependency Injection tokens (`IUserRepository`, `IPropertyRepository`, etc.).
   - Services evaluate cache hits/misses through `ICacheService.getOrSet()`.
   - Services interact with external APIs (Cloudinary via `IUploadService`).
   - Domain events are dispatched asynchronously via `EventEmitter2`.
4. **Exit & Error Sanitization:**
   - **`ResponseInterceptor`:** Normalizes all successful responses into the contract `{ success: true, message: string, data: T }`.
   - **`GlobalExceptionFilter`:** Intercepts `AppException` (structured, `errorCode` preserved) and `HttpException` (mapped via `mapHttpStatusToErrorCode()`: 400→`VALIDATION_FAILED`, 401→1100, 403→`FORBIDDEN`, 404→`RESOURCE_NOT_FOUND`). **Any other thrown value — including raw Prisma errors — is treated as unhandled and returns HTTP 500** with `GENERAL_ERRORS.INTERNAL_SERVER_ERROR`, after logging the raw exception to `console.error`.

---

## 2. Structural Breakpoints, Vulnerabilities & Bottlenecks

### 2.1 Critical Architectural Breakpoints

#### BP-01: In-Memory `setTimeout` Verification Queue Loss (Volatile State)
- **Component:** `PrototypeBackgroundTaskService` (`apps/api/src/infrastructure/background-task/services/prototype-background-task.service.ts`).
- **Mechanism:** Property verification requests (`POST /v1/properties/:id/submit`) schedule verification via `setTimeout(fn, this.delayMs)`, where `delayMs = config.verificationDelayMs ?? 3000`.
- **Breakpoint Impact:**
  1. If the Node.js process terminates, restarts (e.g., CI/CD deploy, PM2 reload, pod crash), or scales horizontally, all scheduled in-memory timers are destroyed. Properties remain stuck in `pending` indefinitely, with a `Verification` row stuck at `status: 'pending'`.
  2. Under serverless deployments (referenced by `vercel.ts` and `vercel.json`), execution halts immediately upon sending the HTTP 202 Accepted response. The `setTimeout` event loop task is frozen or terminated by the runtime before firing.
- **QA Verification Test:** Submit a property, kill the API process within 1.5 seconds, restart the process, and query `GET /v1/properties/my`. Verify state remains `pending` with `Verification.status` still `'pending'` and no `'property.verified'`/`'property.rejected'` event ever emitted.

#### BP-02: Verification State Machine Disconnect (Properties Never Activated) — **Highest severity in this document**
- **Component:** `VerificationService.processVerification` & `PrismaPropertyRepository.updateVerificationStatus`.
- **Mechanism:** When `MockVerificationService.verify()` returns `status: 'verified'`, `VerificationService` invokes `PropertyService.updateVerificationStatus()`. `PrismaPropertyRepository.updateVerificationStatus()` only updates the `Verification` model table (`verification.status = 'verified'`, `verification.verified_at = now()`).
- **Defect:** The `Property` table record itself is **never updated**. `property.status` remains `'pending'` forever, `property.is_verified` remains `false`. Note that `PrismaPropertyRepository.updateStatus(propertyId, status)` **already exists** and is fully implemented (`prisma-property.repository.ts:661`) — it is simply never called from anywhere in the verification path. This is the fastest fix available: wire `updateStatus(propertyId, 'active')` into `updateVerificationStatus` when `status === 'verified'`.
- **Breakpoint Impact:** Because `PropertyService.findAll()` and `PropertyService.findOne()` explicitly filter on `property.status = 'active'`, verified properties are **permanently hidden from public search and direct lookup** unless manually updated by an admin using `PATCH /v1/properties/:id/admin`.
- **Compounding effect:** see **BP-06** — because status never advances past `'pending'`, nothing stops the owner from calling `/submit` a second time, which crashes the process.
- **QA Verification Test:** see §5.1 UT-VERIF-03, §5.2 IT-PROP-02, §5.3 E2E-04 (new — this defect had zero test coverage in v1.0.0).

#### BP-03: Business Logic Inversion in `submitForVerification`
- **Component:** `PropertyService.submitForVerification` (`property.service.ts:532`).
- **Code:**
  ```typescript
  if (property.status !== 'pending') {
    throw new AppException(PROPERTY_ERRORS.PROPERTY_CANNOT_SUBMIT);
  }
  ```
- **Defect & Contradiction:** Error code 1521 (`PROPERTY_CANNOT_SUBMIT`) declares the message `"Only draft properties can be submitted for review"`, but the guard requires the property to already be `'pending'` and rejects `'draft'`.
- **Actual behavior (verified against `upsert`):** A property reaches `'pending'` automatically the moment `title`, `type`, `listing_type`, and `price` are all non-empty (`computeStatus()`), whether at creation or via a later `PATCH`/`POST` upsert. So most listings **do** reach `'pending'` and submission is not permanently blocked — but the error message is actively wrong and will confuse both users and support staff the one time this branch does fire (e.g., resubmission attempts, or a race — see BP-06).
- **Fix required:** either correct the message to say "Only pending properties can be submitted for review," or change the guard to accept `'draft'` and internally re-run `computeStatus()`/full-field validation as the gate — whichever matches actual product intent.

#### BP-04: List Cache Invalidation Mismatch (Permanent Stale Data)
- **Component:** `PropertyService.invalidateListCache()` (`property.service.ts:35-37`).
- **Code:**
  ```typescript
  private async invalidateListCache() {
    await this.cacheService.del('properties:list:all');
  }
  ```
- **Defect:** In `findAll()`, cache keys are dynamically assembled with JSON serialization: `properties:list:{"page":1,"limit":20,"sort_by":"created_at_desc",...}`. `cacheService.del()` only deletes the exact literal key `'properties:list:all'`, which is never the key actually written by `findAll()`.
- **Breakpoint Impact:** Creating, updating, archiving, or deleting properties does not purge cached public query listings. Stale property listings persist until the list TTL expires (60s).
- **Parallel Issue in Area Module:** `AreaService.findAll()` hardcodes the cache key to the literal `'areas:list'` (confirmed at `area.service.ts:21`) regardless of query filters. Any query filter combination (`?city=Dhaka`, `?search=Gulshan`, `?page=2`) returns the exact cached result of whichever query variant executed first, and `del('areas:list')` on write (`area.service.ts:98,128,163`) only ever clears that one variant.

#### BP-05 (NEW): Malformed UUID Path Parameters Cause an Uncaught HTTP 500
- **Component:** All controllers using `@Param('id')` without a pipe — confirmed via `grep -rn "ParseUUIDPipe"` returning **zero matches** in `apps/api/src`.
- **Mechanism:** `id` path params are passed as raw strings straight into Prisma `where: { id }` clauses (e.g., `PrismaPropertyRepository.findById`, `PrismaAreaRepository.findById`, `PrismaUserRepository.findById`). None of these read methods are wrapped in `handlePrismaError()` — that helper is only invoked from `create`/`update`/`delete` call sites in the property, area, and user repositories.
- **Defect:** A non-UUID string routed to a Postgres `uuid` column throws a Prisma error (invalid input syntax) that is neither an `AppException` nor a NestJS `HttpException`. `GlobalExceptionFilter`'s `else` branch catches it and returns **HTTP 500** with a generic internal-error body, after `console.error`-logging the raw exception (potentially including stack traces to server logs, though not to the client).
- **Breakpoint Impact:** Every public and authenticated `GET/PATCH/DELETE /:id` endpoint across Property, Area, and User modules is vulnerable to a trivial malformed-input 500 — this is both a QA defect (poor client experience) and a minor information/availability concern (uncaught exceptions are more expensive per-request than a validated 400, and stack traces land in server logs).
- **QA Verification Test:** `GET /v1/properties/non-uuid-string-123` → expect HTTP 500 (documents current broken behavior; flag as regression once `ParseUUIDPipe` or equivalent validation is added — target state is HTTP 400 with `error_code: 1001`).

#### BP-06 (NEW): Resubmission After Verification Crashes the Process (Compounds BP-02 + BP-03)
- **Component:** `PropertyService.submitForVerification` → `PropertyService.createVerification` → `PrismaPropertyRepository.createVerification`.
- **Mechanism:** `Verification.property_id` is declared `@unique` in `prisma/schema.prisma:286`. `submitForVerification` only requires `property.status === 'pending'` to proceed (§BP-03). Because of BP-02, a property's status **never leaves `'pending'`** even after verification completes. Nothing prevents the owner from calling `POST /v1/properties/:id/submit` a second time.
- **Defect:** The second call reaches `PrismaPropertyRepository.createVerification()` (`prisma-property.repository.ts:618`), which calls `prisma.verification.create({ data: { property_id, status: 'pending' } })` with **no `handlePrismaError` wrapper and no pre-check for an existing row**. Postgres rejects the insert with a unique-constraint violation (Prisma error `P2002`); the raw error is neither `AppException` nor `HttpException`, so it falls into `GlobalExceptionFilter`'s catch-all → **HTTP 500**.
- **Breakpoint Impact:** Any user who double-clicks "Submit for Verification," or resubmits after receiving a rejection notification, receives a 500 instead of a clear "already submitted" error. This is a direct, reproducible consequence of BP-02 remaining unfixed — fixing BP-02 alone (advancing `property.status` off `'pending'`) closes this path too, since `submitForVerification`'s status guard would then reject the second call with a proper 400 before ever reaching `createVerification`.
- **QA Verification Test:** Submit a property, wait ≥8s (see corrected timing note in Flow 2) for verification to complete, then submit the same property ID again → expect HTTP 500 today; target state after fixing BP-02 is HTTP 400 (`PROPERTY_CANNOT_SUBMIT`).

### 2.2 Security Vulnerabilities & Bottlenecks

#### SEC-01: Broken Object-Level Authorization (BOLA / IDOR) on User Profile Management — Confirmed, High Severity
- **Component:** `UserController` (`apps/api/src/modules/user/user.controller.ts`).
- **Vulnerability:** Confirmed by direct inspection — the controller class has **no `@UseGuards(...)` beyond the global `JwtAuthGuard`, and no `@Permissions(...)` decorator anywhere in the file**. `GET /v1/users`, `GET /v1/users/:id`, `PATCH /v1/users/:id`, and `DELETE /v1/users/:id` require only a valid JWT — no ownership check (`req.user.id === param.id`) and no role/permission check.
- **Exploitation Vector:** Any authenticated regular tenant or buyer can send `DELETE /v1/users/<target-uuid>` or `PATCH /v1/users/<target-uuid>` to modify or purge any other account, including administrative accounts, across the platform. `GET /v1/users` additionally enumerates **every user record** to any authenticated caller.
- **Remediation direction:** add an ownership guard (`req.user.id === params.id`) with an `isAdmin` override via `@Permissions('manage_users')`, mirroring the pattern already used correctly in `PropertyService.upsert`/`remove` (`existing.user_id === userId || isAdmin`).

#### SEC-02: Content-Type Spoofing & Multer In-Memory Buffering
- **Component:** `UploadService` (`upload.utils.ts` & `cloudinary.service.ts`).
- **Vulnerability:**
  1. `validateFileType()` relies exclusively on the client-supplied `file.mimetype` header. It does not inspect file magic bytes, so a client can label any binary as `Content-Type: image/jpeg`.
  2. Multer is configured with `memoryStorage()`. Video uploads up to `UPLOAD_LIMITS_MB.VIDEO = 100` (100MB) are buffered entirely in Node.js process heap before being streamed to Cloudinary.
- **Risk framing:** Since files are streamed directly to Cloudinary (not executed or served from this process), the MIME spoofing risk here is primarily **downstream trust** (whatever consumes the Cloudinary URL later must not assume the extension/content-type is accurate) rather than remote code execution on this server. The memory-buffering concern is real but its practical impact (RAM ceiling, concurrent-upload limits) has **not been load tested** — treat the "1.5GB / 15 concurrent uploads" figure from v1.0.0 as an illustrative back-of-envelope calculation (`15 × 100MB`), not a measured result.
- **QA action:** (a) add a magic-byte check (e.g., `file-type` package) before trusting `file.mimetype`; (b) run an actual load test with concurrent large-file uploads against a staging instance to get a real OOM threshold before treating this as a P0.

#### SEC-03: Permission Guard Runs a DB Query on Every Protected Call (Hardening Recommendation, Not a Confirmed Bottleneck)
- **Component:** `PermissionsGuard` (`apps/api/src/modules/role/guards/permissions.guard.ts`).
- **Current behavior:** On every request to a `@Permissions(...)`-decorated route, the guard executes:
  ```typescript
  await this.prisma.userRole.count({
    where: {
      user_id: userId,
      role: { role_permissions: { some: { permission: { name: { in: requiredPermissions } } } } }
    }
  });
  ```
- **Assessment:** This is a legitimate N+1-per-request pattern with no caching or JWT-embedded claims, and it will become a bottleneck under sustained load on protected routes. **No load test has been run against this codebase** — the "500 RPS / connection pool saturation" figure in v1.0.0 was speculative and has been removed. Treat this as a performance hardening item: recommend adding a short-TTL cache (`ICacheService`, keyed by `userId:permission`) or embedding permission claims in the JWT with a revocation strategy, and validate the actual threshold with `autocannon`/`k6` against a seeded permissions table before prioritizing.

#### SEC-04: `DELETE /v1/roles/revoke` Requires a Request Body (Operational Risk, Not Yet Observed in Production)
- **Component:** `RoleController.removeRole` (`apps/api/src/modules/role/role.controller.ts:45-47`).
- **Confirmed:** `DELETE /v1/roles/revoke` expects `AssignRoleDto` (`{ userId, roleId }`) in the request body — confirmed at the controller.
- **Risk framing:** Some HTTP clients, proxies, and CDN/WAF configurations drop bodies on `DELETE`; this is real but environment-dependent (Node's own `http`/`fetch`, `axios`, and most modern browsers do forward DELETE bodies fine). No evidence in this codebase's current deployment config (`vercel.json`, CORS origins) shows an intermediary that strips it. **Action:** verify against the actual Vercel + any CDN/WAF in front of production before treating as confirmed; regardless, converting this to `POST /v1/roles/revoke` or `DELETE /v1/roles/:roleId/users/:userId` (params only, no body) removes the risk entirely and is recommended on REST-convention grounds alone.

---

## 3. Comprehensive API & Business Logic Catalog

### 3.1 Authentication Module (`/v1/auth`)

| Endpoint | Method | Auth Guard | Throttle | DTO / Payload | Success | Error Codes |
|---|---|---|---|---|---|---|
| `/v1/auth/register` | `POST` | Public | Global default | `RegisterDto`: `full_name` (string, 2-100), `email` (valid email), `password` (string) | `201 Created`<br>`{ access_token, refresh_token, user }` | `1101` (Email exists)<br>`1102` (Weak password)<br>`1001` (Validation fail) |
| `/v1/auth/login` | `POST` | `LocalAuthGuard` | **Global default — no route override** (`THROTTLE_LIMIT`/`THROTTLE_TTL`, default 10/60000ms) | `LoginDto`: `email` (string), `password` (string) | `200 OK`<br>`{ access_token, refresh_token, user }` | `1100` (Invalid credentials) |
| `/v1/auth/refresh` | `POST` | Public | Global default | `RefreshTokenDto`: `refresh_token` (UUID string) | `200 OK`<br>`{ access_token, refresh_token }` | `1103` (Invalid token)<br>`1104` (Expired token)<br>`1105` (No identity) |
| `/v1/auth/logout` | `POST` | `JwtAuthGuard` | Global default | `RefreshTokenDto`: `refresh_token` (UUID string) | `200 OK`<br>`{ message: "Logged out..." }` | `1100` (Unauthorized) |
| `/v1/auth/me` | `GET` | `JwtAuthGuard` | Global default | None | `200 OK`<br>`{ id, full_name, email, email_verified, ... }` | `1107` (User not found) |
| `/v1/auth/change-password` | `PATCH` | `JwtAuthGuard` | Global default | `ChangePasswordDto`: `current_password` (string), `new_password` (string, 8-128) | `200 OK`<br>`{ message: "Password changed..." }` | `1102` (Password weak)<br>`1108` (Wrong current)<br>`1109` (Identical password) |

#### Auth Business Logic & Corner Cases
- **Password Strength Rules (`password.util.ts`):** No whitespace allowed; length must be 8–72 characters (bcrypt truncates/limits beyond 72); at least one letter and one digit. **Contradiction confirmed:** `ChangePasswordDto.new_password` is decorated `@MaxLength(128)`, so a 100-character password passes DTO validation but is then rejected by `validatePassword()` at the service layer with a message about the 72-char limit — the DTO's stated bound is misleading to API consumers/frontend devs relying on Swagger.
- **Refresh Token Rotation (confirmed in `auth.service.ts:160-169` and `prisma-auth.repository.ts:134-149`):** `rotateRefreshToken` runs the revoke-old + insert-new pair inside a single `prisma.$transaction`. `findRefreshTokenWithUser` filters `revoked_at: null` (`prisma-auth.repository.ts:84`), so **reuse of an already-rotated token is correctly rejected** with `INVALID_REFRESH_TOKEN` (1103) — this is *not* a bug, but it is an important behavior to have an explicit regression test for (see IT-AUTH-03).
- **Password Change Side-Effect:** Calling `changePassword` issues `revokeAllRefreshTokensForUser`, immediately invalidating all active mobile and web sessions for that account.

---

### 3.2 User Module (`/v1/users`)

| Endpoint | Method | Auth Guard | Permission | DTO / Payload | Success | Error Codes |
|---|---|---|---|---|---|---|
| `/v1/users` | `GET` | `JwtAuthGuard` | **None — SEC-01** | None | `200 OK`<br>`User[]` list | `1100` (Unauthorized) |
| `/v1/users/avatar` | `POST` | `JwtAuthGuard` | None | Multipart `file` (Binary buffer) | `201 Created`<br>Updated `User` | `1210` (Bad MIME)<br>`1211` (File > 10MB)<br>`1212` (Upload fail) |
| `/v1/users/avatar` | `DELETE` | `JwtAuthGuard` | None | None | `200 OK`<br>Updated `User` | `1200` (User/Asset not found) |
| `/v1/users/:id` | `GET` | `JwtAuthGuard` | **None — SEC-01** | Param: `id` (UUID) | `200 OK`<br>`User` object | `1200` (User not found)<br>**500 on malformed UUID — BP-05** |
| `/v1/users/:id` | `PATCH` | `JwtAuthGuard` | **None — SEC-01** | Param: `id`, Body: `UpdateUserDto` (`full_name` only, 2-100 chars) | `200 OK`<br>Updated `User` | `1200` (User not found)<br>**500 on malformed UUID — BP-05** |
| `/v1/users/:id` | `DELETE` | `JwtAuthGuard` | **None — SEC-01** | Param: `id` (UUID) | `200 OK`<br>`{ message: "User deleted..." }` | `1200` (User not found)<br>**500 on malformed UUID — BP-05** |

#### User Business Logic & Corner Cases
- **`UpdateUserDto` is single-field** — confirmed at `modules/user/dto/update-user.dto.ts`: only `full_name` (`@IsOptional @MinLength(2) @MaxLength(100)`). Any other field in the PATCH body is silently stripped by `ForbiddenNonWhitelisted` if unknown, or rejected as an unexpected property.
- **Avatar Lifecycle:** Uploading a new avatar queries `UserAsset` for `source: 'AVATAR'`. If found, the existing Cloudinary asset is destroyed, the old DB row deleted, and the new asset stored. If Cloudinary upload succeeds but the Prisma DB write fails, an explicit rollback deletes the newly uploaded Cloudinary file.
- **Cache Eviction:** Updating user profile or avatar purges `users:profile:<id>` and `users:list`.

---

### 3.3 Role & Permission RBAC Module (`/v1/roles`)

| Endpoint | Method | Auth Guard | Permission | DTO / Payload | Success | Error Codes |
|---|---|---|---|---|---|---|
| `/v1/roles` | `GET` | `JwtAuthGuard` | `view_roles` | None | `200 OK`<br>`Role[]` | `1003` (Forbidden) |
| `/v1/roles/:id` | `GET` | `JwtAuthGuard` | `view_roles` | Param: `id` (UUID) | `200 OK`<br>`Role` detail | `1300` (Role not found) |
| `/v1/roles/user/:userId` | `GET` | `JwtAuthGuard` | `view_roles` | Param: `userId` (UUID) | `200 OK`<br>`Role[]` of user | `1003` (Forbidden) |
| `/v1/roles/assign` | `POST` | `JwtAuthGuard` | `manage_roles` | `AssignRoleDto`: `userId`, `roleId` | `201 Created`<br>`UserRole` record | `1300` (Not found)<br>`1301` (Already assigned) |
| `/v1/roles/revoke` | `DELETE` | `JwtAuthGuard` | `manage_roles` | Body: `AssignRoleDto`: `userId`, `roleId` — **see SEC-04, verify client/proxy forwards DELETE bodies** | `200 OK`<br>`{ message: "Role revoked" }` | `1300` (Not assigned) |
| `/v1/roles/:roleId/permissions` | `POST` | `JwtAuthGuard` | `manage_roles` | Param: `roleId`, Body: `AssignPermissionDto`: `permissionId` | `201 Created`<br>`RolePermission` | `1302` (Perm not found)<br>`1303` (Already assigned) |
| `/v1/roles/:roleId/permissions/:permissionId` | `DELETE` | `JwtAuthGuard` | `manage_roles` | Params: `roleId`, `permissionId` | `200 OK`<br>`{ message: "Revoked" }` | `1302` (Not found) |

---

### 3.4 Area Hierarchy Module (`/v1/areas`)

| Endpoint | Method | Auth Guard | Permission | DTO / Payload | Success | Error Codes |
|---|---|---|---|---|---|---|
| `/v1/areas` | `GET` | Public | None | Query: `city`, `parent_area_id`, `search`, `page`, `limit` | `200 OK`<br>Paginated Area list (**stale — BP-04**) | None |
| `/v1/areas/:id` | `GET` | Public | None | Param: `id` (UUID) | `200 OK`<br>Area detail | `1400` (Area not found)<br>**500 on malformed UUID — BP-05** |
| `/v1/areas/:id/children` | `GET` | Public | None | Param: `id` (UUID) | `200 OK`<br>Child `Area[]` | `1400` (Area not found) |
| `/v1/areas` | `POST` | `JwtAuthGuard` | `manage_areas` | `CreateAreaDto`: `name`, `city`, `parent_area_id`, `boundary`, `centroid` | `201 Created`<br>Created Area | `1401` (Duplicate name in city) |
| `/v1/areas/:id` | `PATCH` | `JwtAuthGuard` | `manage_areas` | Param: `id`, Body: `UpdateAreaDto` | `200 OK`<br>`{ id }` | `1400` (Area not found) |
| `/v1/areas/:id` | `DELETE` | `JwtAuthGuard` | `manage_areas` | Param: `id` (UUID) | `200 OK`<br>`{ message: "Area deleted" }` | `1400` (Not found)<br>`1402` (Has active listings) |

#### Area Business Logic & Corner Cases
- **Referential Integrity on Deletion:** Area deletion validates `countActiveProperties(id)`. If any property has status `'active'` linked to this area, HTTP 400 (`AREA_HAS_ACTIVE_LISTINGS`) is thrown. **Not covered:** areas with **child areas** (not properties) — `area.service.ts` has no equivalent `countChildAreas()` guard before delete, so deleting a parent orphans its children's `parent_area_id` foreign key unless the DB schema cascades or restricts it (verify against `prisma/schema.prisma` relation mode — see IT-AREA-02).
- **Self-Referential Hierarchy — confirmed unguarded:** `AreaService.update()` (`area.service.ts:103-128`) connects `parent_area_id` directly with no check that `dto.parent_area_id !== id`. Setting an area's `parent_area_id` to its own `id` will either succeed (creating a self-referential loop that breaks any recursive `findChildren` traversal) or throw a raw, unmapped Prisma FK/cycle error depending on schema constraints — this needs to be tested and is currently **untested** (see BB-AREA-01).

---

### 3.5 Property Management Module (`/v1/properties`)

| Endpoint | Method | Auth Guard | Permission / Scope | DTO / Payload | Success | Error Codes |
|---|---|---|---|---|---|---|
| `/v1/properties` | `GET` | Public | None | `PropertyQueryDto`: `search`, `city`, `type`, `listing_type`, `min_price`, `max_price`, `lat`, `lng`, `radius`, `page`, `limit` | `200 OK`<br>Paginated Property items (**stale — BP-04**) | None |
| `/v1/properties/admin` | `GET` | `JwtAuthGuard` | `manage_properties` | `PropertyQueryDto` | `200 OK`<br>Admin Paginated list | `1003` (Forbidden) |
| `/v1/properties/my` | `GET` | `JwtAuthGuard` | Owner | `PropertyQueryDto` | `200 OK`<br>User's Properties | `1100` (Unauthorized) |
| `/v1/properties/saved` | `GET` | `JwtAuthGuard` | Owner | None | `200 OK`<br>Saved property list | None |
| `/v1/properties/:id` | `GET` | Public | None | Param: `id` (UUID) | `200 OK`<br>Property detail | `1500` (Not found or inactive)<br>**500 on malformed UUID — BP-05** |
| `/v1/properties` | `POST` | `JwtAuthGuard` | Authenticated (create path, `dto.property_id` absent) | `UpsertPropertyDto`: `area_id` (**required**), `title`, `type`, `listing_type`, `price`, `amenities`, etc. | `201 Created`<br>Property record, `status: 'pending'` if `REQUIRED_FIELDS` complete else `'draft'` | `1502` (Missing area)<br>`1503` (Bad amenities)<br>`1400` (Bad area) |
| **`/v1/properties/:id`** | **`PATCH`** | **`JwtAuthGuard`** | **Owner or Admin (`existing.user_id === userId \|\| isAdmin`)** | **Body: `UpsertPropertyDto` with `property_id` implied by route param — routes internally to `upsert()`'s update path** | **`200 OK`<br>Updated Property; `status` recomputed via `computeStatus()` on the merged existing+new required fields unless caller `isAdmin` and supplies `status` explicitly** | **`1500` (Not found)<br>`403` (Not owner, not admin)<br>`1503` (Bad amenities)<br>`1400` (Bad area, if `area_id` changed)** |
| `/v1/properties/:id/submit` | `POST` | `JwtAuthGuard` | Owner only — **no admin bypass** (confirmed: `submitForVerification(id, userId)` signature has no `isAdmin` param, unlike `upsert`/`remove`) | Param: `id` (UUID) | `202 Accepted`<br>`{ id, status: 'pending' }` | `1500` (Not found)<br>`1521` (Status not pending / missing fields)<br>**500 on resubmission after verification — BP-06** |
| `/v1/properties/:id/save` | `POST` | `JwtAuthGuard` | Authenticated | Param: `id` (UUID) | `201 Created`<br>`{ saved: true }` | `1500` (Property inactive/missing) |
| `/v1/properties/:id/save` | `DELETE` | `JwtAuthGuard` | Authenticated | Param: `id` (UUID) | `200 OK`<br>`{ saved: false }` | `1500` (Property not found) |
| `/v1/properties/:id` | `DELETE` | `JwtAuthGuard` | Owner or Admin | Param: `id` (UUID) | `200 OK`<br>Soft deleted (status → `archived`) | `1500` (Not found)<br>`1522` (Status not active/sold, non-admin only) |
| `/v1/properties/:id/media` | `POST` | `JwtAuthGuard` | Owner | Multipart file, Body: `CreatePropertyMediaDto` (`media_type`, `display_order`) | `201 Created`<br>`PropertyMedia` record | `1511` (Invalid file)<br>`1512` (Too large)<br>`1513` (Limit reached) |
| `/v1/properties/media/:mediaId` | `DELETE` | `JwtAuthGuard` | Owner | Param: `mediaId` (UUID) | `200 OK`<br>`{ message: "Deleted" }` | `1510` (Media not found) |
| `/v1/properties/:id/admin` | `PATCH` | `JwtAuthGuard` | `manage_properties` | Param: `id`, Body: `UpsertPropertyDto` (admin may set `status` directly) | `200 OK`<br>Updated Property | `1500` (Not found) |
| `/v1/properties/:id/admin` | `DELETE` | `JwtAuthGuard` | `manage_properties` | Param: `id` (UUID) | `200 OK`<br>`{ message: "Hard deleted" }` | `1500` (Not found) |

#### Property Core Business Rules
1. **Creation vs. Update Strategy (Upsert):**
   - If `dto.property_id` is supplied (equivalently, if the caller hits `PATCH /:id`, which the controller wires to `upsert()`'s update path), the service validates ownership (`existing.user_id === userId || isAdmin`).
   - Otherwise (`POST /v1/properties`, `property_id` absent), the service uses the **Create Path**; `dto.area_id` is strictly mandatory and validated against `Area` before insert.
2. **Dynamic Initial Status Calculation:**
   - `REQUIRED_FIELDS = ['title', 'type', 'listing_type', 'price']`.
   - Create path: if all four are present with non-empty values → `'pending'`; otherwise → `'draft'`.
   - Update path: **admin override** — if `dto.status !== undefined && isAdmin`, status is set directly to the requested value with no further validation. Otherwise, status is recomputed from the merge of `dto` fields over `existing` fields, and only written if it actually changed from `existing.status` — meaning **a property can silently transition `draft → pending` on any PATCH that fills the last required field**, which is by design but worth an explicit regression test (WB-PROP-05).
3. **Verification Submission Gatekeeper (`submitForVerification`):**
   - Requires ownership (no admin bypass — confirmed).
   - Requires status to be exactly `'pending'`.
   - Requires full dataset completeness: `title`, `description`, `type`, `listing_type`, `price > 0`, `area_id`, `area_size > 0`, `area_unit`, `address`, `location_lat`, `location_lng`, AND `countMediaTotal(id) > 0`.
   - Creates a `Verification` row, then calls `IBackgroundTaskService.enqueueVerification(id)` (fire-and-forget `setTimeout`).
   - **Total async completion time is 5000–8000ms**, not the 3000ms suggested by the raw `delayMs` config alone — see the corrected Flow 2 in §4.
4. **Media Limits:** Max 20 images per property (10MB each, JPEG/PNG/WebP); max 3 videos per property (100MB each, MP4/QuickTime).
5. **View Count Side-Effect:** `GET /v1/properties/:id` triggers an asynchronous atomic increment: `prisma.property.update({ data: { view_count: { increment: 1 } } })`.

---

## 4. Dual-Perspective Flow Specifications

### Flow 1: New User Registration & Authenticated Session
```
[ User Action / Frontend ]                 [ Technical Execution / Backend QA ]
1. Enters Full Name, Email, Password  ───► 1. POST /v1/auth/register
                                           2. ValidationPipe checks length, format
                                           3. validatePassword() asserts regex & 8-72 chars
                                           4. authRepo checks Provider: LOCAL + lower(email)
                                           5. bcrypt.hash(password, 12 rounds)
                                           6. User & AuthIdentity created in Prisma transaction
                                           7. JWT signed (HS256) & RefreshToken UUID hashed (SHA256)
2. Receives tokens & profile state   ◄─── 8. 201 Created: { access_token, refresh_token, user }
3. Navigates to Protected Area       ───► 9. GET /v1/auth/me (Header: Bearer <access_token>)
                                           10. JwtAuthGuard decodes sub & sets req.user
                                           11. Cache checked: auth:profile:<userId> (TTL: 300s)
4. Displays User Profile             ◄─── 12. 200 OK: User JSON payload
```

### Flow 2: Property Creation, Media Attachment, and Verification Lifecycle
```
[ User Action / Frontend ]                 [ Technical Execution / Backend QA ]
1. Fills Step 1 Listing Form         ───► 1. POST /v1/properties
   (Title, Type, Price, AreaId)            2. Area existence validated in DB
                                           3. computeStatus() marks status = 'pending'
                                           4. Property created in DB
2. Receives Property ID (<UUID>)     ◄─── 5. 201 Created: { id: "prop-123", status: "pending" }
3. Uploads Cover Photo (Multipart)   ───► 6. POST /v1/properties/prop-123/media
                                           7. Multer buffers file to memory
                                           8. validateFileType checks mimetype starts with image/
                                           9. Cloudinary upload_stream streams buffer to CDN
                                           10. PropertyMedia created with display_order = 0
4. Image uploaded successfully       ◄─── 11. 201 Created: PropertyMedia JSON
5. Clicks "Submit for Verification"  ───► 12. POST /v1/properties/prop-123/submit
                                           13. Checks user_id === req.user.id (no admin bypass)
                                           14. Asserts all 11 fields + media count > 0
                                           15. Inserts Verification row (status: pending)
                                           16. enqueueVerification() calls
                                               setTimeout(fn, delayMs=3000)
6. Receives "Submission Accepted"    ◄─── 17. 202 Accepted: { id: "prop-123", status: "pending" }
                                           === [ t+3000ms: setTimeout fires ] ===
                                           18. VerificationService.processVerification runs
                                           19. MockVerificationService.verify() adds its OWN
                                               internal delay: 2000 + Math.random()*3000 ms
                                               (i.e. total elapsed since submit ≈ 5000-8000ms)
                                           20. Evaluates last char of property UUID:
                                               - '0'-'7': verified
                                               - '8': rejected ("Manual review required")
                                               - '9'/other: rejected ("Document verification failed")
                                           21. updateVerificationStatus() updates ONLY the
                                               Verification row — property.status is
                                               NEVER updated (BP-02: property stays 'pending'
                                               and stays invisible to public search forever)
                                           22. EventEmitter2 emits 'property.verified' or
                                               'property.rejected' regardless of step 21's gap
                                           23. VerificationListener catches event
                                           24. MockNotificationService writes log line to console
   ⚠ QA must wait ≥ 8-9 seconds (not 3-4s) before asserting on verification outcome to avoid
     flaky tests caused by the provider's own randomized delay.
```

### Flow 3: Public Property Search & Proximity Filtering
```
[ User Action / Frontend ]                 [ Technical Execution / Backend QA ]
1. Searches "Gulshan" with Lat/Lng   ───► 1. GET /v1/properties?lat=23.79&lng=90.41&radius=5
2. Pipeline processes request              2. Cache key calculated: properties:list:{...}
                                           3. Cache miss: execute repository query
                                           4. Bounding box calculated:
                                              latDelta = 5 / 111.0; lngDelta = 5 / (111 * cos(lat))
                                           5. SQL query executes with status: 'active' filter
                                           6. Post-query Haversine distance computation applied
                                           7. In-memory filter: distance <= 5 km
                                           8. Sorted by distance ASC
                                           9. Result cached in MemoryCache (TTL: 60s)
3. Displays Map Markers & List       ◄─── 10. 200 OK: { items: [...], total, page, limit }
   ⚠ Because of BP-02, a property that finished verification will NEVER appear here —
     it stays status: 'pending' and this endpoint filters on status: 'active'.
```

---

## 4.5 Test Fixtures & Bootstrap Sequence (NEW)

v1.0.0 referenced fixture IDs (`role-admin-001`, `prop-A`, `<User-B-UUID>`) with no procedure to create them. This section makes every test in §5 runnable end-to-end against a freshly seeded database.

### 4.5.1 Database Seed
```bash
npx prisma migrate reset --force --skip-seed
npm run seed:roles       # creates Role rows: 'admin', 'user' + Permission rows incl.
                          # 'manage_properties', 'manage_areas', 'manage_roles', 'view_roles'
npm run seed:areas       # creates at least one Area with a known id, referenced below as $AREA_ID
```
After seeding, capture the generated IDs for reuse across the test suite (exact query depends on your seed script's output — print or `SELECT` them):
```sql
SELECT id, name FROM "Role" WHERE name IN ('admin', 'user');
SELECT id, name FROM "Permission" WHERE name = 'manage_properties';
SELECT id, city FROM "Area" LIMIT 1;
```

### 4.5.2 Bootstrap Two Users + One Admin
```bash
# User A (property owner)
curl -s -X POST $BASE/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"full_name":"User A","email":"usera@test.local","password":"Passw0rd1"}'
# → capture .data.access_token as $TOKEN_A, .data.user.id as $USER_A_ID

# User B (attacker / second party in IDOR tests)
curl -s -X POST $BASE/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"full_name":"User B","email":"userb@test.local","password":"Passw0rd1"}'
# → capture $TOKEN_B, $USER_B_ID

# Promote a third user to admin by directly assigning the seeded admin Role
# (requires DB access or an already-privileged bootstrap account — document your
#  project's actual admin bootstrap procedure here; there is no self-service admin signup)
curl -s -X POST $BASE/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"full_name":"Admin","email":"admin@test.local","password":"Passw0rd1"}'
# then, using a seeded/bootstrap admin token or direct DB insert into UserRole:
curl -s -X POST $BASE/v1/roles/assign -H "Authorization: Bearer $BOOTSTRAP_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"userId":"'$ADMIN_USER_ID'","roleId":"'$ADMIN_ROLE_ID'"}'
# → login as admin@test.local to obtain $TOKEN_ADMIN
```

### 4.5.3 Create a Reference Property (`$PROPERTY_A_ID`)
```bash
curl -s -X POST $BASE/v1/properties -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"area_id":"'$AREA_ID'","title":"Test Listing","type":"residential",
       "listing_type":"rent","price":25000}'
# → capture .data.id as $PROPERTY_A_ID, expect status: "pending" (all 4 REQUIRED_FIELDS present)
```

This fixture set is the precondition for every `IT-*`, `E2E-*`, and `SEC-TEST-*` row in §5 that references "Property A," "User A/B," or an admin token — those rows no longer assume undocumented fixtures.

---

## 5. Actionable Testing Scenarios

### 5.1 Unit Testing Scenarios

| Test ID | Module / Component | Target Function | Test Input / Precondition | Expected Output / Assertion |
|---|---|---|---|---|
| **UT-AUTH-01** | `password.util` | `validatePassword` | Input: `"Pass 1234"` (contains space) | `isValid: false`, `errors` includes `"Password cannot contain spaces."` |
| **UT-AUTH-02** | `password.util` | `validatePassword` | Input: `"a".repeat(73)` (length 73, contains digit `"1"`) | `isValid: false`, `errors` includes `"Password cannot exceed 72 characters."` |
| **UT-AUTH-03** | `password.util` | `validatePassword` | Input: `"alllowercase1"` | `isValid: true` |
| **UT-AUTH-04** | `auth.service` | `register` | Mock repo returns existing user identity for email | Throws `AppException` with `AUTH_ERRORS.EMAIL_ALREADY_EXISTS` (code 1101, HTTP 409) |
| **UT-PROP-01** | `property.service` | `computeStatus` | Object with `title`, `type`, `listing_type`, `price: 5000` | Returns `'pending'` |
| **UT-PROP-02** | `property.service` | `computeStatus` | Object with `title`, `type`, `listing_type`, missing `price` | Returns `'draft'` |
| **UT-PROP-03** | `property.service` | `validateAmenities` | `type: "residential"`, `amenities: { bedrooms: 3 }` | Returns `true` |
| **UT-PROP-04** | `property.service` | `validateAmenities` | `type: "invalid_type"`, `amenities: { foo: "bar" }` | Returns `false` |
| **UT-UPLD-01** | `upload.utils` | `validateFileType` | `mimetype: "application/x-sh"`, allowed: `IMAGES` | Throws `AppException(PROPERTY_ERRORS.MEDIA_INVALID_FILE_TYPE)` (code 1511) |
| **UT-UPLD-02** | `upload.utils` | `validateFileSize` | `size: 11 * 1024 * 1024`, limit: `10` | Throws `AppException(PROPERTY_ERRORS.MEDIA_FILE_TOO_LARGE)` (code 1512) |
| **UT-VERIF-01** | `mock-verification` | `verify` | `propertyId: "00000000-0000-0000-0000-000000000003"` (ends in `3`) | Returns `{ status: 'verified' }` after 2000-5000ms |
| **UT-VERIF-02** | `mock-verification` | `verify` | `propertyId: "00000000-0000-0000-0000-000000000008"` (ends in `8`) | Returns `{ status: 'rejected', notes: 'Manual review required' }` |
| **UT-VERIF-03** (NEW) | `property.service` | `updateVerificationStatus` | Mock `propertyRepo.updateVerificationStatus` to resolve; spy on `propertyRepo.updateStatus` | **Currently fails** — asserts `propertyRepo.updateStatus` is called with `(propertyId, 'active')` when `status === 'verified'`. This spy call never happens today (BP-02); the test documents the exact missing call to add during the fix. |

---

### 5.2 Integration Testing Scenarios

| Test ID | Scope | Target Action | Test Setup & Fixture | Expected DB State & Service Contract |
|---|---|---|---|---|
| **IT-AUTH-01** | Auth + DB | Refresh Token Rotation | Seed user & active `RefreshToken` row. Invoke `authService.refreshTokens(token)`. | Old token row `revoked_at` is NOT null (set inside the same `$transaction`). New row inserted with new token hash and `expires_at = now() + 7 days`. New token pair returned. |
| **IT-AUTH-02** | Auth + DB | Change Password Invalidation | Seed user with 3 active refresh tokens. Invoke `authService.changePassword(userId, dto)`. | `AuthIdentity.password_hash` updated. All 3 refresh tokens have `revoked_at` set. Subsequent `POST /v1/auth/refresh` with any of the 3 old tokens returns HTTP 400 with `error_code: 1103`. |
| **IT-AUTH-03** (NEW) | Auth + DB | Refresh Token Reuse-After-Rotation Is Blocked | Call `refreshTokens(tokenA)` once (succeeds, rotates). Immediately call `refreshTokens(tokenA)` again with the **same, now-stale** token string. | Second call throws `AppException(AUTH_ERRORS.INVALID_REFRESH_TOKEN)` (1103, HTTP 400) — `findRefreshTokenWithUser` filters `revoked_at: null` so the stale hash returns no row. This confirms correct behavior; regression-guard it. |
| **IT-UPLD-01** | Upload + DB | Rollback on DB Crash | Mock `propertyRepo.addMedia` to throw a DB connection error. Call `propertyService.addMedia(...)`. | `uploadService.deleteFile` is triggered with the Cloudinary `public_id`. No orphaned media record remains in Cloudinary or DB. Error 1514 returned. |
| **IT-ROLE-01** | Role + Guards | Permissions Guard Enforcement | Seed user with a role having only `view_roles`. Request `POST /v1/roles/assign` with that user's token. | `PermissionsGuard` returns `false` for the request. HTTP 403 Forbidden received, `error_code: 1003`. DB unchanged. |
| **IT-AREA-01** | Area + DB | Prevent Deletion of Area With Active Property | Seed area `$AREA_ID` with 1 property at `status: 'active'`. Request `DELETE /v1/areas/$AREA_ID`. | Rejection with HTTP 400 (`AREA_HAS_ACTIVE_LISTINGS`, code 1402). Area remains in DB. |
| **IT-AREA-02** (NEW) | Area + DB | Deleting a Parent Area With Child Areas (Untested Path) | Seed `$PARENT_AREA_ID` and a child area with `parent_area_id: $PARENT_AREA_ID` (no properties attached). Request `DELETE /v1/areas/$PARENT_AREA_ID`. | **Currently unspecified by the service layer** — assert the actual observed behavior (likely a raw, unmapped Prisma FK-constraint error → HTTP 500, or a silent orphan if the schema uses `onDelete: SetNull`). Whatever the result, add an explicit `countChildAreas()` guard mirroring `countActiveProperties()`, mapped to a proper `AREA_HAS_CHILDREN` `AppException`, and update this row to the intended 400 contract once fixed. |
| **IT-PROP-01** | Property + Events | Event Dispatch on Verification | Trigger `verificationService.processVerification(propId)` directly (bypassing the `setTimeout` delay). Spy on `eventEmitter.emit`. | Emits `'property.verified'` or `'property.rejected'` with a `PropertyVerifiedEvent`/`PropertyRejectedEvent` payload carrying the correct `propertyId` and `userId`. |
| **IT-PROP-02** (NEW) | Property + DB | Verification Does Not Activate the Property (BP-02 regression guard) | Seed a `'pending'` property with `Verification.status: 'pending'`. Call `verificationService.processVerification(propId)` with a mocked provider returning `{ status: 'verified' }`. | Query `Property.status` after the call. **Documents current (broken) behavior: still `'pending'`, `is_verified: false`.** Once BP-02 is fixed, flip this assertion to `status: 'active'`, `is_verified: true` — this test must exist in the suite either way so the fix is provable. |

---

### 5.3 System & End-to-End (E2E) Testing Scenarios

| Test ID | Journey Scenario | Sequence of API Invocations | Expected System State / Verifications |
|---|---|---|---|
| **E2E-01** | User Onboarding & Profile Update | 1. `POST /v1/auth/register`<br>2. `POST /v1/auth/login`<br>3. `GET /v1/auth/me`<br>4. `PATCH /v1/users/:id` (own id)<br>5. `GET /v1/auth/me` | Registration succeeds (201). Profile retrieved. Name updated via PATCH. Subsequent GET returns new `full_name`. `auth:profile:<userId>` cache entry reflects the new value (confirm via a second GET after the cache TTL boundary, or assert cache invalidation directly). |
| **E2E-02** | Complete Listing & Submission Flow | 1. `POST /v1/properties` (4 required fields)<br>2. `POST /v1/properties/:id/media` (upload image)<br>3. `PATCH /v1/properties/:id` (add `area_size`, `area_unit`, `address`, `location_lat`, `location_lng`, `description`)<br>4. `POST /v1/properties/:id/submit`<br>5. Poll `GET /v1/properties/:id/admin` (admin token) **every 1s for up to 10s** | Property created (`status: 'pending'`). Media added. Full-field validation passes on submit (202). `Verification` row created with `status: 'pending'`, then transitions to `'verified'`/`'rejected'` within the 10s window. **`Property.status` is asserted to remain `'pending'` even after `Verification.status` becomes `'verified'` — this is BP-02 and is the documented current behavior, not a test bug.** |
| **E2E-03** | Saved Property Bookmark Cycle | 1. User A logs in<br>2. `POST /v1/properties/:id/save`<br>3. `GET /v1/properties/saved`<br>4. `DELETE /v1/properties/:id/save`<br>5. `GET /v1/properties/saved` | Property saved (201). Appears in saved list array. Unsaved successfully (200). Removed from saved array. A repeat `POST /save` on an already-saved property is rejected or idempotent per the unique index — assert the actual returned status code rather than assuming. |
| **E2E-04** (NEW) | Resubmission After Verification Crashes (BP-02 × BP-06) | 1. Run E2E-02 through step 5 (wait for `Verification.status` to leave `'pending'`)<br>2. `POST /v1/properties/:id/submit` again with the same owner token | **Current behavior: HTTP 500** (unique constraint violation on `Verification.property_id`, uncaught). This is the compound failure described in BP-06 — the test exists to prove the fix: once BP-02 makes `property.status` advance past `'pending'`, this second call must instead return HTTP 400 (`PROPERTY_CANNOT_SUBMIT`) from the existing status guard, before ever reaching `createVerification`. |
| **E2E-05** (NEW) | Unsave a Now-Archived Property | 1. User A saves Property A<br>2. User A archives Property A via `DELETE /v1/properties/:id` (requires status `active`/`sold` — seed accordingly, or use admin `PATCH .../admin` to force `status: 'active'` first)<br>3. `DELETE /v1/properties/:id/save` | Document the actual returned status/body — `unsaveProperty` does not appear to gate on property status, so this likely still returns `200 { saved: false }` even though the property is archived. Confirm and record as expected behavior, or file as a defect if the product intent is to block interaction with archived listings. |

---

### 5.4 Black Box Testing Scenarios (Boundary Value & Equivalence)

| Test ID | Endpoint | Test Field & Partition | Input Value | Expected Status Code & Error Structure |
|---|---|---|---|---|
| **BB-VAL-01** | `POST /v1/auth/register` | `full_name` below min boundary | `""` or `"A"` (length < 2) | `400 Bad Request`<br>`{ success: false, error_code: 1001, data: { errors: [...] } }` |
| **BB-VAL-02** | `POST /v1/auth/register` | `full_name` above max boundary | `"A".repeat(101)` | `400 Bad Request`<br>`{ success: false, error_code: 1001 }` |
| **BB-VAL-03** | `POST /v1/auth/register` | Unknown field injection | Body: `{ full_name: "John", email: "j@x.com", password: "Passw0rd1", hacker_field: true }` | `400 Bad Request`<br>`error_code: 1001`, message contains `"property hacker_field should not exist"` (`forbidNonWhitelisted`) |
| **BB-PROP-01** | `POST /v1/properties` | `price` negative boundary | `{ price: -500, ... }` | `400 Bad Request`, `error_code: 1001` — class-validator constraint violation on the DTO |
| **BB-PROP-02** | `GET /v1/properties` | `limit` excessive boundary | `GET /v1/properties?limit=500` | **Verify the actual `PropertyQueryDto` `@Max()` decorator value and assert that exact cap** — do not assume a number; if no `@Max()` exists, this is itself a defect (unbounded `limit` lets a caller force an expensive full-table scan) and should be filed as such rather than tested as a pass. |
| **BB-PROP-03** | `GET /v1/properties/:id` | Malformed UUID param | `GET /v1/properties/non-uuid-string-123` | **`500 Internal Server Error`** — confirmed current behavior per BP-05 (no `ParseUUIDPipe`, unwrapped `findById`). Target/fixed-state expectation: `400 Bad Request` with `error_code: 1001` once a UUID pipe is added. |
| **BB-PROP-04** | `POST /v1/properties/:id/media` | File size boundary + 1 byte | Upload file with size `10,485,761` bytes (10MB + 1) | `400 Bad Request`<br>`{ success: false, error_code: 1512 }` |
| **BB-AREA-01** (NEW) | `PATCH /v1/areas/:id` | Self-referential `parent_area_id` | `{ parent_area_id: "<same id as :id>" }` | **Untested/unguarded — run and record the actual result.** No application-level check exists (`area.service.ts:117-121` connects unconditionally); result depends entirely on whether the DB schema/driver rejects the cycle. File as a defect if it succeeds silently, since it will break `findChildren` recursion. |

---

### 5.5 White Box Testing Scenarios (Path & Branch Coverage)

> v1.0.0 cited absolute line numbers that do not match the file's own internal `lineNumber` logger metadata (proof the file has already drifted once). This revision references branch **conditions**, which survive refactors; look up current line numbers with `grep -n` immediately before running.

| Test ID | File & Method | Branch Under Test | Test Input / Mocking Strategy | Verification Target |
|---|---|---|---|---|
| **WB-PROP-01** | `property.service.ts` → `upsert` | `if (dto.property_id) { … }` — Update vs. Create path | Test 1: payload without `property_id`<br>Test 2: payload with `property_id: "<uuid>"` | Test 1 executes the Create Path (`propertyRepo.create`, mandatory `area_id` check). Test 2 executes the Update Path (`propertyRepo.findById` → ownership check → `propertyRepo.update`). |
| **WB-PROP-02** | `property.service.ts` → `upsert` (Update path) | `if (existing.user_id !== userId && !isAdmin)` | Mock `existing.user_id = "user-1"`, pass `userId = "user-2"`, `isAdmin = false` | Throws `ForbiddenException('You do not have permission to update this property')`. |
| **WB-PROP-03** | `property.service.ts` → `remove` | `if (!isAdmin && property.status !== 'active' && property.status !== 'sold')` | Mock property with `status: 'draft'`, call `remove(id, userId, false)` | Throws `AppException(PROPERTY_ERRORS.PROPERTY_CANNOT_ARCHIVE)` (code 1522). |
| **WB-PROP-04** | `property.service.ts` → `findAll` | Proximity search branch: `lat`, `lng`, `radius` all supplied vs. absent | Test 1: supply `lat`, `lng`, `radius`<br>Test 2: supply only `city` | Test 1 executes `propertyRepo.findWithProximitySearch`. Test 2 executes the standard published-listing query path. |
| **WB-PROP-05** (NEW) | `property.service.ts` → `upsert` (Update path) | `if (dto.status !== undefined && isAdmin) { … } else { /* recompute via computeStatus */ }` | Test 1: `isAdmin: true`, `dto.status: 'sold'` on a `'draft'` property<br>Test 2: `isAdmin: false`, PATCH that fills the last missing `REQUIRED_FIELD` on a `'draft'` property | Test 1: `updateData.status = 'sold'` set directly, no recomputation. Test 2: `computeStatus()` runs on the merged existing+new required fields and flips `status` to `'pending'` — confirms the "silent draft→pending on any completing PATCH" behavior noted in §3.5 Rule 2. |
| **WB-MEDIA-01** | `property.service.ts` → `addMedia` | `dto.display_order === undefined` (auto-increment branch) | Pass `dto.display_order: undefined`. Mock `findLastMediaOrder` returning `4`. | `displayOrder` computed as `4 + 1 = 5`. |
| **WB-VERIF-01** (NEW) | `verification.service.ts` → `processVerification` | `catch (error) { … }` — swallowed-error branch | Mock `verificationProvider.verify()` to throw. | Error is logged via `this.logger.error(...)` and **the method returns normally with no re-throw** — confirm no unhandled promise rejection propagates back to `PrototypeBackgroundTaskService`'s `.catch()`, and that the `Verification` row is left at `status: 'pending'` indefinitely (a second, quieter variant of BP-01/BP-02: a provider exception leaves the property stuck with no retry and no user-facing signal). |

---

### 5.6 Penetration & Security Testing Scenarios (OWASP API Top 10 Aligned)

| Test ID | Vulnerability Class | Attack Vector / Test Injection | Defensive Assertion & Expected Behavior |
|---|---|---|---|
| **SEC-TEST-01** | API1:2023 Broken Object Level Auth (BOLA) | User A authenticates ($TOKEN_A). Issues `DELETE /v1/users/$USER_B_ID` with $TOKEN_A. | **Current confirmed behavior: HTTP 200, User B is deleted** (SEC-01). Target/fixed-state assertion: HTTP 403 Forbidden. This test currently documents a live defect, not a passing control — do not mark it "passing" until an ownership/role guard ships. |
| **SEC-TEST-02** | API1:2023 BOLA / Property Hijacking | User A creates Property A (`$PROPERTY_A_ID`). User B authenticates and sends `PATCH /v1/properties/$PROPERTY_A_ID` with $TOKEN_B and body `{ "title": "Hacked" }`. | HTTP 403 Forbidden (`ForbiddenException` from the confirmed ownership check in `upsert`'s update path). Record in database remains unmodified. **This control works correctly** — confirmed at `property.service.ts:150-156`. |
| **SEC-TEST-03** | API2:2023 Broken Authentication | Send `GET /v1/users` with: (1) missing `Authorization` header; (2) an expired JWT; (3) a JWT re-signed with an altered HMAC secret. | All three rejected with HTTP 401, `error_code: 1100` (per `mapHttpStatusToErrorCode`). Response body contains no stack trace (confirm `GlobalExceptionFilter` only logs raw exceptions server-side via `console.error`, never in the response). |
| **SEC-TEST-04** | API3:2023 Broken Object Property Level Auth | Regular user ($TOKEN_A, no `manage_roles` permission) sends `POST /v1/roles/assign` with `{ "userId": "$USER_A_ID", "roleId": "$ADMIN_ROLE_ID" }`. | `PermissionsGuard` detects the missing `manage_roles` permission. HTTP 403, `error_code: 1003`. `UserRole` table unchanged — verify by count before/after. |
| **SEC-TEST-05** | API4:2023 Unrestricted Resource Consumption | Flood `POST /v1/auth/login` with `THROTTLE_LIMIT + 5` requests within `THROTTLE_TTL` ms from a single IP. **Requires setting `THROTTLE_LIMIT` and `THROTTLE_TTL` explicitly for this test run** — the `.env.test` values in §6.1 (`THROTTLE_LIMIT=100`) are too high to trip in a short test; override to e.g. `THROTTLE_LIMIT=10`, `THROTTLE_TTL=60000` for this specific test process/run. | With the override in place: `ThrottlerGuard` returns HTTP 429 starting at request 11. Without overriding the env, this test will incorrectly report a false negative — do not run it against the shared `.env.test` defaults. |
| **SEC-TEST-06** | API8:2023 Security Misconfiguration (CORS) | Send `OPTIONS /v1/properties` with header `Origin: https://malicious-attacker-domain.com`. | Response does **not** include `Access-Control-Allow-Origin: https://malicious-attacker-domain.com` — confirm the actual header value returned (likely absent entirely, or echoing a whitelisted default) rather than assuming "browser blocks it," since a missing header alone is what a test can assert. |
| **SEC-TEST-07** | File Upload MIME-Type Bypass | `POST /v1/properties/:id/media` with a script payload named `shell.php`, header `Content-Type: image/jpeg`. | **Current confirmed behavior: the upload succeeds** — `validateFileType()` only checks the client-supplied `mimetype` header (SEC-02), so this passes validation and is streamed to Cloudinary as-is. This is not a remote-code-execution risk against this server (no local execution path), but it is a confirmed input-validation gap: assert the file is accepted today, then re-run after a magic-byte check (`file-type` package) ships and expect HTTP 400 (`error_code: 1511`). |
| **SEC-TEST-08** | SQL / Prisma Query Injection Resistance | Supply `?search=%27%20OR%201=1%20--` to `GET /v1/properties`. | Prisma's parameterized queries treat the input as a literal string search term. Assert the response `total` count equals the count of properties whose title/description literally contains that string (almost certainly `0` in a seeded test DB, but assert the count, not a hardcoded `0`, so the test is not fragile against seed data changes). No database syntax error is leaked in the response body or logs. |

---

## 6. QA Test Execution & CI Automation Directives

### 6.1 Environment Configuration Matrix
Before launching tests, ensure the following environment variables are provisioned in `.env.test`:
```ini
NODE_ENV=test
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/homenet_test?schema=public"
DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@localhost:5432/homenet_test?schema=public"
JWT_SECRET="test-jwt-secret-key-minimum-32-chars-for-security"
JWT_EXPIRES_IN="15m"
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
CLOUDINARY_CLOUD_NAME="mock-cloud"
CLOUDINARY_API_KEY="000000000000"
CLOUDINARY_API_SECRET="mock-secret"
```
> **SEC-TEST-05 requires a lower `THROTTLE_LIMIT` than the shared default above.** Either run that one test with an overridden env (`THROTTLE_LIMIT=10 THROTTLE_TTL=60000 npx jest ...`), or add a dedicated `.env.throttle-test` and document the override in the test file itself — do not rely on the shared 100-req default to exercise rate limiting.

### 6.2 Test Command Directives
```bash
# 1. Reset and migrate test database
npx prisma migrate reset --force --skip-seed
npm run seed:roles
npm run seed:areas

# 2. Run all unit test suites
npm run test

# 3. Run unit tests with code coverage assessment
npm run test:cov

# 4. Run End-to-End integration tests
npm run test:e2e

# 5. Targeted test execution for property module
npx jest --testPathPattern="src/modules/property" --verbose
```

### 6.3 Test Success Metrics & Exit Criteria
- **Unit Test Line Coverage:** ≥ 85% across all service domains (`auth`, `property`, `area`, `user`).
- **Branch Coverage:** ≥ 80% on conditional gates (`computeStatus`, `validatePassword`, `validateFileType`, `PermissionsGuard`).
- **Defect Remediation Verification — prior to production sign-off, verify fixes for:**
  1. **BP-02:** Property activation upon verification (`property.status = 'active'`, `property.is_verified = true`) — verified via IT-PROP-02 and E2E-02.
  2. **BP-03:** `submitForVerification` error message corrected to match actual guard logic.
  3. **BP-04:** Wildcard/proper cache key eviction on list endpoints (Property and Area).
  4. **BP-05:** `ParseUUIDPipe` (or equivalent) added to every `:id`/`:userId`/`:roleId`/`:mediaId` route param, changing malformed-input responses from 500 to 400. Verified via BB-PROP-03.
  5. **BP-06:** Resubmission after verification returns a proper 400, not a 500 — this should resolve automatically once BP-02 is fixed, but must be re-verified via E2E-04, not assumed.
  6. **SEC-01:** Ownership/role guard implemented on all four `/v1/users/:id` mutation and enumeration endpoints. Verified via SEC-TEST-01.
- **Do not sign off SEC-TEST-01 or E2E-04 as "passing"** until the underlying code changes ship — as written today, both tests correctly assert on confirmed-broken behavior, which is expected and intentional during this QA pass, not a testing error.
