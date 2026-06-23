import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AppException } from '../errors/app.exception.js';
import { GENERAL_ERRORS } from '../errors/error-codes.js';
import type { ApiResponse } from '../response/api-response.interface.js';

/**
 * Global exception filter that formats ALL errors into
 * the standardized ApiResponse shape:
 *
 *  { success: false, message: "...", error_code: 1100, data: null }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let errorCode: number;
    let message: string;
    let data: any = null;

    if (exception instanceof AppException) {
      // ── Our custom structured exception ──────────────
      status = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      // ── Standard NestJS exceptions (ValidationPipe, Guards, etc.) ──
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, any>;

        // ValidationPipe returns { message: string[] | string, error, statusCode }
        if (Array.isArray(res.message)) {
          message = res.message.join('; ');
          data = { errors: res.message };
        } else {
          message = res.message ?? exception.message;
          // Preserve extra data like validation errors array
          if (res.errors) {
            data = { errors: res.errors };
          }
        }
      } else {
        message = exception.message;
      }

      // Map common HTTP statuses to our error codes
      errorCode = this.mapHttpStatusToErrorCode(status);
    } else {
      // ── Unexpected / unhandled error ────────────────
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = GENERAL_ERRORS.INTERNAL_SERVER_ERROR.code;
      message = GENERAL_ERRORS.INTERNAL_SERVER_ERROR.message;

      // Log unexpected errors to stderr
      console.error('[GlobalExceptionFilter] Unhandled exception:', exception);
    }

    const body: ApiResponse<null> = {
      success: false,
      message,
      error_code: errorCode,
      data,
    };

    response.status(status).json(body);
  }

  private mapHttpStatusToErrorCode(status: number): number {
    switch (status) {
      case 400:
        return GENERAL_ERRORS.VALIDATION_FAILED.code;
      case 401:
        return 1100; // Default auth error
      case 403:
        return GENERAL_ERRORS.FORBIDDEN.code;
      case 404:
        return GENERAL_ERRORS.RESOURCE_NOT_FOUND.code;
      default:
        return GENERAL_ERRORS.INTERNAL_SERVER_ERROR.code;
    }
  }
}
