import type { ErrorDefinition } from '../error-definition.interface.js';

// ── User Module Errors (1200–1299) ──────────────────────

export const USER_ERRORS = {
  USER_NOT_FOUND: {
    code: 1200,
    message: 'User not found',
    httpStatus: 404,
  },
  USER_UPDATE_FAILED: {
    code: 1201,
    message: 'Failed to update user profile',
    httpStatus: 500,
  },
  USER_DELETE_FAILED: {
    code: 1202,
    message: 'Failed to delete user',
    httpStatus: 500,
  },
} as const satisfies Record<string, ErrorDefinition>;
