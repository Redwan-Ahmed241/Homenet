import type { ErrorDefinition } from '../error-definition.interface.js';

// ── Role Module Errors (1300–1399) ──────────────────────

export const ROLE_ERRORS = {
  ROLE_NOT_FOUND: {
    code: 1300,
    message: 'Role not found',
    httpStatus: 404,
  },
  ROLE_ALREADY_ASSIGNED: {
    code: 1301,
    message: 'Role is already assigned to this user',
    httpStatus: 409,
  },
  PERMISSION_NOT_FOUND: {
    code: 1302,
    message: 'Permission not found',
    httpStatus: 404,
  },
  PERMISSION_ALREADY_ASSIGNED: {
    code: 1303,
    message: 'Permission is already assigned to this role',
    httpStatus: 409,
  },
  INSUFFICIENT_ROLE: {
    code: 1304,
    message: 'You do not have the required role to access this resource',
    httpStatus: 403,
  },
} as const satisfies Record<string, ErrorDefinition>;
