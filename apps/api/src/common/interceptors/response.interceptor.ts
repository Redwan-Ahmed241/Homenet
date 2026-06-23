import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse } from '../response/api-response.interface.js';

/**
 * Global response interceptor that wraps all successful controller
 * return values into the standardized ApiResponse shape:
 *
 *  { success: true, message: "OK", data: { ... } }
 *
 * If the controller already returns an object with a `message` property,
 * that message is extracted and used instead of the default "OK".
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If controller returns { message: '...', ...rest }, extract the message
        let message = 'OK';
        let responseData = data;

        if (data && typeof data === 'object' && 'message' in data) {
          message = data.message;
          // Remove message from data to avoid duplication
          const { message: _, ...rest } = data;
          responseData = Object.keys(rest).length > 0 ? rest : null;
        }

        return {
          success: true,
          message,
          data: responseData ?? null,
        };
      }),
    );
  }
}
