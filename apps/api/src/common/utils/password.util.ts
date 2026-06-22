export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a password based on specific constraints.
 * 
 * @param password The password string to validate.
 * @param isStrict If true, applies strict (bank-level) validation (uppercase, lowercase, number).
 *                 If false, applies balanced validation (min 1 letter, min 1 number).
 * @returns An object containing the validity status and an array of error messages for broken constraints.
 */
export function validatePassword(password: string, isStrict: boolean = false): PasswordValidationResult {
  const errors: string[] = [];

  if (typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required.'] };
  }

  if (/\s/.test(password)) {
    return {
      isValid: false,
      errors: ['Password cannot contain spaces.'],
    };
  }

  // 1. Length constraints (apply to both modes)
  // Max 72 characters is standard for bcrypt hashing limitations
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (password.length > 72) {
    errors.push('Password cannot exceed 72 characters.');
  }

  // 2. Character type constraints
  if (isStrict) {
    // Strict constraints: uppercase, lowercase, and number
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number.');
    }
  } else {
    // Balanced constraints: at least 1 letter (any case) + 1 number
    if (!/[a-zA-Z]/.test(password)) {
      errors.push('Password must contain at least one letter.');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
