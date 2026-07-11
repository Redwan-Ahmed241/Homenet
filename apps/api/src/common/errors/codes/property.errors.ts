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
  MEDIA_INVALID_FILE_TYPE: {
    code: 1511,
    message: 'Invalid file type. Allowed types: JPEG, PNG, WebP (images), MP4, MOV (videos)',
    httpStatus: 400,
  },
  MEDIA_FILE_TOO_LARGE: {
    code: 1512,
    message: 'File size exceeds the maximum allowed limit',
    httpStatus: 400,
  },
  MEDIA_LIMIT_REACHED: {
    code: 1513,
    message: 'Media limit reached for this property',
    httpStatus: 400,
  },
  MEDIA_UPLOAD_FAILED: {
    code: 1514,
    message: 'Failed to upload media to storage',
    httpStatus: 500,
  },
} as const satisfies Record<string, ErrorDefinition>;
