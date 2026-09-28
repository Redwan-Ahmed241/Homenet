import { Injectable } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { scrubSecrets } from './llm-crypto.util.js';
import { LLM_KEY_STATUS } from './llm.types.js';

const MAX_ERROR_LENGTH = 500;

/** Per-key telemetry, written without blocking the user's response. */
@Injectable()
export class LlmMetricsService {
  /** Connects persistent key telemetry and logging for background write failures. */
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  /** Records success asynchronously and reactivates a cooled key only when its cooldown has expired or is unset. */
  recordSuccess(keyId: string): void {
    this.runInBackground(
      'recordSuccess',
      this.prisma.$executeRaw`
        UPDATE llm_api_keys
        SET success_count = success_count + 1,
            last_success_at = NOW(),
            status = CASE
              WHEN status = ${LLM_KEY_STATUS.COOLDOWN} AND (cooldown_until IS NULL OR cooldown_until <= NOW())
                THEN ${LLM_KEY_STATUS.ACTIVE}
              ELSE status
            END,
            updated_at = NOW()
        WHERE id = CAST(${keyId} AS uuid)`,
    );
  }

  /** Records failure asynchronously with a redacted, length-limited error message. */
  recordFailure(keyId: string, error: string): void {
    const lastError = scrubSecrets(error).slice(0, MAX_ERROR_LENGTH);
    this.runInBackground(
      'recordFailure',
      this.prisma.$executeRaw`
        UPDATE llm_api_keys
        SET failure_count = failure_count + 1,
            last_failed_at = NOW(),
            last_error = ${lastError},
            updated_at = NOW()
        WHERE id = CAST(${keyId} AS uuid)`,
    );
  }

  /** Extends Vercel execution for a telemetry write and logs rejection without propagating it to the caller. */
  private runInBackground(functionName: string, write: Promise<unknown>): void {
    waitUntil(
      write.catch((error: Error) => {
        this.logger.warn(`LLM telemetry write failed: ${error.message}`, {
          fileName: 'llm-metrics.service.ts',
          functionName,
          lineNumber: 56,
        });
      }),
    );
  }
}
