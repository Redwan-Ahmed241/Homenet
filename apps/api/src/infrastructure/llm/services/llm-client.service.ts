import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { AppException } from '../../../common/errors/app.exception.js';
import { AI_ERRORS } from '../../../common/errors/error-codes.js';
import { LlmRotatorService } from './llm-rotator.service.js';
import { LlmMetricsService } from './llm-metrics.service.js';
import { parseDurationSeconds } from '../utils/llm-rotation.util.js';
import { scrubSecrets } from '../utils/llm-crypto.util.js';
import { LLM_PROVIDER } from '../llm.constants.js';
import type { ILlmProvider } from '../interfaces/llm-provider.interface.js';
import type { ChatJsonOptions, KeyLease } from '../llm.types.js';

const MAX_ATTEMPTS = 3;
const SOFT_LIMIT_REMAINING_REQUESTS = 2;
const DEFAULT_COOLDOWN_SECONDS = 60;
// Vercel kills the function at 30s (vercel.json maxDuration); leave room to respond.
const TOTAL_BUDGET_MS = 25_000;
const MIN_ATTEMPT_MS = 2_000;

type FailureOutcome = 'retry' | 'fatal';

@Injectable()
export class LlmClientService {
  /** Connects shared key rotation, request telemetry and logging for LLM provider calls. */
  constructor(
    private readonly rotator: LlmRotatorService,
    private readonly metrics: LlmMetricsService,
    private readonly logger: LoggerService,
    @Inject(LLM_PROVIDER) private readonly provider: ILlmProvider,
  ) {}

  /** Runs one JSON-mode chat completion, failing over across accounts. Every call takes the next key. */
  async chatJson(options: ChatJsonOptions): Promise<Record<string, unknown>> {
    const triedAccounts = new Set<string>();
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const remainingMs = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remainingMs < MIN_ATTEMPT_MS) break;

      const lease = await this.rotator.acquire(triedAccounts);
      if (!lease) break;
      triedAccounts.add(lease.accountId);

      this.logger.info(
        `LLM ${options.label} attempt ${attempt} → ${lease.alias} (${lease.accountId})`,
        {
          fileName: 'llm-client.service.ts',
          functionName: 'chatJson',
          lineNumber: 45,
        },
      );

      try {
        const { content, headers } = await this.provider.chatJson(
          lease.client,
          {
            model: options.model,
            messages: options.messages,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
          },
          Math.min(options.timeoutMs, remainingMs),
        );

        this.metrics.recordSuccess(lease.id);
        await this.applySoftLimit(lease, headers);
        return this.parseJson(content, options.label);
      } catch (error) {
        if (error instanceof AppException) throw error;
        if (
          (await this.handleFailure(lease, error, options.label)) === 'fatal'
        ) {
          throw new AppException(AI_ERRORS.AI_REQUEST_FAILED);
        }
      }
    }

    this.logger.error(
      `LLM ${options.label} gave up after trying ${triedAccounts.size} account(s)`,
      {
        fileName: 'llm-client.service.ts',
        functionName: 'chatJson',
        lineNumber: 79,
      },
    );
    throw new AppException(AI_ERRORS.AI_SERVICE_UNAVAILABLE);
  }

  /** Cools the leased account when response headers report at most two remaining requests. */
  private async applySoftLimit(
    lease: KeyLease,
    headers: Headers,
  ): Promise<void> {
    const remainingHeader = headers.get('x-ratelimit-remaining-requests');
    if (remainingHeader === null) return;

    const remaining = Number(remainingHeader);
    if (
      !Number.isFinite(remaining) ||
      remaining > SOFT_LIMIT_REMAINING_REQUESTS
    )
      return;

    const seconds =
      parseDurationSeconds(headers.get('x-ratelimit-reset-requests')) ??
      DEFAULT_COOLDOWN_SECONDS;
    await this.rotator.cooldownAccount(
      lease,
      seconds,
      `soft limit, ${remaining} requests left`,
    );
  }

  /** Records a scrubbed failure, applies cooldown or revocation when needed and classifies whether to retry. */
  private async handleFailure(
    lease: KeyLease,
    error: unknown,
    label: string,
  ): Promise<FailureOutcome> {
    const { status, retryAfter } = this.provider.getErrorInfo(error);
    const message = scrubSecrets(
      error instanceof Error ? error.message : String(error),
    );
    this.metrics.recordFailure(lease.id, `${status ?? 'network'}: ${message}`);

    if (status === 429) {
      const seconds =
        parseDurationSeconds(retryAfter) ?? DEFAULT_COOLDOWN_SECONDS;
      await this.rotator.cooldownAccount(lease, seconds, 'HTTP 429');
      return 'retry';
    }

    if (status === 401 || status === 403) {
      await this.rotator.revokeKey(lease, `HTTP ${status}`);
      return 'retry';
    }

    // Timeouts, network errors, provider 5xx and Groq's 498 capacity errors are not the key's fault.
    if (status === undefined || status >= 500 || status === 498) {
      this.logger.warn(
        `LLM ${label} transient failure on ${lease.alias}: ${message}`,
        {
          fileName: 'llm-client.service.ts',
          functionName: 'handleFailure',
          lineNumber: 141,
        },
      );
      return 'retry';
    }

    this.logger.error(
      `LLM ${label} request rejected (${status}) on ${lease.alias}: ${message}`,
      {
        fileName: 'llm-client.service.ts',
        functionName: 'handleFailure',
        lineNumber: 152,
      },
    );
    return 'fatal';
  }

  /** Parses a non-null JSON object or throws AI_INVALID_RESPONSE without logging provider content. */
  private parseJson(
    content: string | null | undefined,
    label: string,
  ): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(content ?? '');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
    this.logger.error(`LLM ${label} returned non-JSON content`, {
      fileName: 'llm-client.service.ts',
      functionName: 'parseJson',
      lineNumber: 176,
    });
    throw new AppException(AI_ERRORS.AI_INVALID_RESPONSE);
  }
}
