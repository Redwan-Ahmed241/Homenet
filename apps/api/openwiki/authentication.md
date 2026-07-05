# Authentication

The API uses **JWT** for stateless authentication combined with a **local strategy** for username/password login.

## Login Flow
1. **POST /auth/login** – receives `LoginDto` (`email`, `password`).
2. `LocalAuthGuard` (based on `passport-local`) validates credentials via `AuthService.validateUser`.
3. On success, `AuthService.login` issues a **JWT** signed with `JWT_SECRET` (configured in `.env`).
4. JWT is returned in the response body and should be included in subsequent requests as `Authorization: Bearer <token>`.

## Refresh Token
- **POST /auth/refresh-token** – accepts `RefreshTokenDto` and returns a new JWT.
- Refresh tokens are stored and rotated as per `AuthService.refreshToken` implementation.

## Guard & Decorator
- `JwtAuthGuard` (`src/common/guards/jwt-auth.guard.ts`) is registered as a global `APP_GUARD` so every request is validated unless marked with the `@Public()` decorator (`src/common/decorators/public.decorator.ts`).
- **Public routes** (e.g., login, signup) are annotated with `@Public()` to bypass JWT validation.

## DTOs
- `login.dto.ts`, `register.dto.ts`, `refresh-token.dto.ts` – define input validation using `class-validator`.

## Swagger
All auth endpoints are documented via `@nestjs/swagger` decorators in `auth.controller.ts`.  The Swagger UI is available at `/api/docs` after the server starts.

## Extending Authentication
- Add new strategies (e.g., OAuth) by creating a new `Strategy` class and updating `AuthModule` providers.
- Secure new routes by default – they will be protected by `JwtAuthGuard` unless explicitly marked `@Public()`.

---
**Key files**: `src/modules/auth/*`, `src/common/guards/jwt-auth.guard.ts`, `src/common/decorators/public.decorator.ts`
