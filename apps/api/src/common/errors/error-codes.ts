// ─────────────────────────────────────────────────────────
// Barrel re-export — keeps existing imports working
// ─────────────────────────────────────────────────────────

export type { ErrorDefinition } from './error-definition.interface.js';
export { SYSTEM_ERRORS } from './codes/system.errors.js';
export { AUTH_ERRORS } from './codes/auth.errors.js';
export { USER_ERRORS } from './codes/user.errors.js';
export { ROLE_ERRORS } from './codes/role.errors.js';
export { AREA_ERRORS } from './codes/area.errors.js';

// Backward compatibility alias
export { SYSTEM_ERRORS as GENERAL_ERRORS } from './codes/system.errors.js';
