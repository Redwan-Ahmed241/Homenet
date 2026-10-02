import type { ErrorDefinition } from '../error-definition.interface.js';

// ── AI Module Errors (1600–1699) ────────────────────────

export const AI_ERRORS = {
  AI_SERVICE_UNAVAILABLE: {
    code: 1600,
    message:
      'AI service is experiencing high demand. Please try again in a few moments.',
    httpStatus: 503,
  },
  AI_INVALID_RESPONSE: {
    code: 1601,
    message:
      'The AI service returned an unexpected response. Please try again.',
    httpStatus: 502,
  },
  AI_REQUEST_FAILED: {
    code: 1602,
    message: 'The AI service could not process this request.',
    httpStatus: 502,
  },
  AI_QUERY_TOO_SHORT: {
    code: 1603,
    message: 'Please describe what you are looking for in a few more words.',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
