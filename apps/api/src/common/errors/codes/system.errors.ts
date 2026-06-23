import type { ErrorDefinition } from '../error-definition.interface.js';

// ── System / General Errors (1000–1099) ─────────────────

export const SYSTEM_ERRORS = {
  INTERNAL_SERVER_ERROR: {
    code: 1000,
    message: 'An unexpected internal server error occurred',
    httpStatus: 500,
  },
  VALIDATION_FAILED: {
    code: 1001,
    message: 'Request validation failed',
    httpStatus: 400,
  },
  RESOURCE_NOT_FOUND: {
    code: 1002,
    message: 'The requested resource was not found',
    httpStatus: 404,
  },
  FORBIDDEN: {
    code: 1003,
    message: 'You do not have permission to perform this action',
    httpStatus: 403,
  },
} as const satisfies Record<string, ErrorDefinition>;
