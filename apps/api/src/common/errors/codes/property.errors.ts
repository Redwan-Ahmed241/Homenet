import type { ErrorDefinition } from '../error-definition.interface.js';

// ── Property Module Errors (1500–1599) ──────────────────

export const PROPERTY_ERRORS = {
  PROPERTY_NOT_FOUND: {
    code: 1500,
    message: 'Property not found',
    httpStatus: 404,
  },
  PROPERTY_ACCESS_DENIED: {
    code: 1501,
    message: 'You do not have permission to modify this property',
    httpStatus: 403,
  },
  PROPERTY_INVALID_AMENITIES: {
    code: 1503,
    message: 'Invalid amenities structure for the specified property type',
    httpStatus: 400,
  },
  MEDIA_NOT_FOUND: {
    code: 1510,
    message: 'Media not found',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
