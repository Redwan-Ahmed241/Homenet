import { HttpException } from '@nestjs/common';
import type { ErrorDefinition } from './error-definition.interface.js';

/**
 * Custom application exception that carries a structured error code.
 *
 * Usage:
 *   throw new AppException(AUTH_ERRORS.INVALID_CREDENTIALS);
 *   throw new AppException(AUTH_ERRORS.PASSWORD_TOO_WEAK, 'Must include a number');
 */
export class AppException extends HttpException {
  public readonly errorCode: number;

  constructor(errorDef: ErrorDefinition, customMessage?: string) {
    const message = customMessage ?? errorDef.message;

    super(
      {
        error_code: errorDef.code,
        message,
      },
      errorDef.httpStatus,
    );

    this.errorCode = errorDef.code;
  }
}
