import type { ErrorDefinition } from '../error-definition.interface.js';

// ── Auth Module Errors (1100–1199) ──────────────────────

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 1100,
    message: 'Invalid email or password',
    httpStatus: 401,
  },
  EMAIL_ALREADY_EXISTS: {
    code: 1101,
    message: 'An account with this email already exists',
    httpStatus: 409,
  },
  PASSWORD_TOO_WEAK: {
    code: 1102,
    message: 'Password does not meet strength requirements',
    httpStatus: 400,
  },
  INVALID_REFRESH_TOKEN: {
    code: 1103,
    message: 'Invalid refresh token',
    httpStatus: 401,
  },
  REFRESH_TOKEN_EXPIRED: {
    code: 1104,
    message: 'Refresh token has expired',
    httpStatus: 401,
  },
  USER_IDENTITY_NOT_FOUND: {
    code: 1105,
    message: 'User identity not found',
    httpStatus: 401,
  },
  JWT_INVALID_OR_EXPIRED: {
    code: 1106,
    message: 'Access token is invalid or has expired',
    httpStatus: 401,
  },
  USER_NOT_FOUND: {
    code: 1107,
    message: 'Authenticated user no longer exists',
    httpStatus: 401,
  },
} as const satisfies Record<string, ErrorDefinition>;
