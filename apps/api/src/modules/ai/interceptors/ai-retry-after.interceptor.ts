import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, catchError, throwError } from 'rxjs';
import { AppException } from '../../../common/errors/app.exception.js';
import { AI_ERRORS } from '../../../common/errors/error-codes.js';

const RETRY_AFTER_SECONDS = '30';

/** Adds Retry-After to 503s so clients back off; the global filter still writes the body. */
@Injectable()
export class AiRetryAfterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (
          error instanceof AppException &&
          error.errorCode === AI_ERRORS.AI_SERVICE_UNAVAILABLE.code
        ) {
          context
            .switchToHttp()
            .getResponse<Response>()
            .setHeader('Retry-After', RETRY_AFTER_SECONDS);
        }
        return throwError(() => error);
      }),
    );
  }
}
