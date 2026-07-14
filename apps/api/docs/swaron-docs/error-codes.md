# Error Codes Reference

All API error responses follow this structure:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": 1100,
  "data": null
}
```

---

## General / System (1000–1099)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1000 | INTERNAL_SERVER_ERROR | 500 | An unexpected internal server error occurred |
| 1001 | VALIDATION_FAILED | 400 | Request validation failed |
| 1002 | RESOURCE_NOT_FOUND | 404 | The requested resource was not found |
| 1003 | FORBIDDEN | 403 | You do not have permission to perform this action |

## Auth Module (1100–1199)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1100 | INVALID_CREDENTIALS | 401 | Invalid email or password |
| 1101 | EMAIL_ALREADY_EXISTS | 409 | An account with this email already exists |
| 1102 | PASSWORD_TOO_WEAK | 400 | Password does not meet strength requirements |
| 1103 | INVALID_REFRESH_TOKEN | 401 | Invalid refresh token |
| 1104 | REFRESH_TOKEN_EXPIRED | 401 | Refresh token has expired |
| 1105 | USER_IDENTITY_NOT_FOUND | 401 | User identity not found |
| 1106 | JWT_INVALID_OR_EXPIRED | 401 | Access token is invalid or has expired |
| 1107 | USER_NOT_FOUND | 401 | Authenticated user no longer exists |

## User Module (1200–1299)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1200 | USER_NOT_FOUND | 404 | User not found |
| 1201 | USER_UPDATE_FAILED | 500 | Failed to update user profile |

## Role Module (1300–1399)

| Code | Name | HTTP Status | Message |
|------|------|-------------|---------|
| 1300 | ROLE_NOT_FOUND | 404 | Role not found |
| 1301 | ROLE_ALREADY_ASSIGNED | 409 | Role is already assigned to this user |
| 1302 | PERMISSION_NOT_FOUND | 404 | Permission not found |
| 1303 | PERMISSION_ALREADY_ASSIGNED | 409 | Permission is already assigned to this role |
| 1304 | INSUFFICIENT_ROLE | 403 | You do not have the required role to access this resource |

---

> **Source of truth:** `src/common/errors/error-codes.ts`
>
> When adding new error codes, update both the TypeScript file and this document.
