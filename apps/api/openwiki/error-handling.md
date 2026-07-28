# Error Handling

The API uses a **structured error system** that provides consistent error codes, messages, and HTTP status codes across the entire stack.

## Core Components
- **ErrorDefinition** (`src/common/errors/error-definition.interface.ts`): shape `{ code: number; message: string; httpStatus: number }`.
- **Error Codes** (`src/common/errors/error-codes.ts`): re‑exports groups of definitions:
  - `SYSTEM_ERRORS`
  - `AUTH_ERRORS`
  - `USER_ERRORS`
  - `ROLE_ERRORS`
- **AppException** (`src/common/errors/app.exception.ts`): custom `HttpException` that takes an `ErrorDefinition` and optional custom message.
- **GlobalExceptionFilter** (`src/common/filters/global-exception.filter.ts`): catches any thrown error, maps it to the unified API response shape.
- **ResponseInterceptor** (`src/common/interceptors/response.interceptor.ts`): formats successful responses into `{ success: true, message, data }`.

## Flow of an Error
1. **Throwing an error** – Service or controller calls `throw new AppException(AUTH_ERRORS.INVALID_CREDENTIALS);`.
2. Nest routes the error to the **GlobalExceptionFilter** because it is registered globally in `src/app.module.ts` (via `APP_FILTER`).
3. The filter distinguishes:
   - **AppException** – extracts the predefined `code`, `message`, and status.
   - **HttpException** (e.g., validation errors) – extracts status/message and maps to a generic error code via `mapHttpStatusToErrorCode`.
   - **Other** – treated as internal server error, logged, and mapped to `GENERAL_ERRORS.INTERNAL_SERVER_ERROR`.
4. The filter builds an `ApiResponse` with `success: false`, the error code, message, and optional data (e.g., validation errors).
5. The response is sent to the client with the appropriate HTTP status.

## Example Error Code Definition (src/common/errors/codes/auth.errors.ts)
```ts
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 1101,
    message: 'Invalid email or password',
    httpStatus: 401,
  },
  // … other auth‑related errors
};
```

## Using the System
- **Controllers**: Throw `AppException` for known error cases.
- **Guards/Interceptors**: Throw `HttpException` for standard Nest errors (e.g., `UnauthorizedException`).
- **Unexpected errors**: Will be caught by the filter, logged, and returned as a generic internal server error.

## Extending Error Codes
1. Add a new entry to the appropriate `*errors.ts` file.
2. Export it via `src/common/errors/error-codes.ts`.
3. Use the new constant in `throw new AppException(NEW_ERROR);
4. Update `docs/error-codes.md` if you maintain a public reference.

---
**Key files**: `src/common/errors/*`, `src/common/filters/global-exception.filter.ts`, `src/common/interceptors/response.interceptor.ts`
