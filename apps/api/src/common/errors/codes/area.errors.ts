import type { ErrorDefinition } from '../error-definition.interface.js';

// ── Area Module Errors (1400–1499) ──────────────────────

export const AREA_ERRORS = {
  AREA_NOT_FOUND: {
    code: 1400,
    message: 'Area not found',
    httpStatus: 404,
  },
  AREA_ALREADY_EXISTS: {
    code: 1401,
    message: 'An area with this name already exists in the specified city',
    httpStatus: 409,
  },
  AREA_HAS_ACTIVE_LISTINGS: {
    code: 1402,
    message: 'Cannot delete area with active property listings',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
