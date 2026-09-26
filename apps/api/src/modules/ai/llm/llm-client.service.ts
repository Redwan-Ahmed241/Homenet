import { Injectable } from '@nestjs/common';
import { APIError } from 'groq-sdk';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { AppException } from '../../../common/errors/app.exception.js';
import { AI_ERRORS } from '../../../common/errors/error-codes.js';
import { LlmRotatorService } from './llm-rotator.service.js';
import { LlmMetricsService } from './llm-metrics.service.js';
import { parseDurationSeconds } from './llm-rotation.util.js';
import { scrubSecrets } from './llm-crypto.util.js';
import type { ChatJsonOptions, KeyLease } from './llm.types.js';

const MAX_ATTEMPTS = 3;
const SOFT_LIMIT_REMAINING_REQUESTS = 2;
const DEFAULT_COOLDOWN_SECONDS = 60;
// Vercel kills the function at 30s (vercel.json maxDuration); leave room to respond.
const TOTAL_BUDGET_MS = 25_000;
const MIN_ATTEMPT_MS = 2_000;

type FailureOutcome = 'retry' | 'fatal';

@Injectable()
export class LlmClientService {
  constructor(
    private readonly rotator: LlmRotatorService,
    private readonly metrics: LlmMetricsService,
    private readonly logger: LoggerService,
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
          lineNumber: 47,
        },
      );

      try {
        const { data, response } = await lease.client.chat.completions
          .create(
            {
              model: options.model,
              messages: options.messages,
              temperature: options.temperature,
              max_completion_tokens: options.maxTokens,
              response_format: { type: 'json_object' },
            },
            {
              timeout: Math.min(options.timeoutMs, remainingMs),
              maxRetries: 0,
            },
          )
          .withResponse();

        this.metrics.recordSuccess(lease.id);
        await this.applySoftLimit(lease, response.headers);
        return this.parseJson(data.choices[0]?.message?.content, options.label);
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
        lineNumber: 86,
      },
    );
    throw new AppException(AI_ERRORS.AI_SERVICE_UNAVAILABLE);
  }

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

  private async handleFailure(
    lease: KeyLease,
    error: unknown,
    label: string,
  ): Promise<FailureOutcome> {
    const status =
      error instanceof APIError
        ? (error.status as number | undefined)
        : undefined;
    const message = scrubSecrets(
      error instanceof Error ? error.message : String(error),
    );
    this.metrics.recordFailure(lease.id, `${status ?? 'network'}: ${message}`);

    if (status === 429) {
      const headers = (error as APIError).headers;
      const seconds =
        parseDurationSeconds(headers?.get('retry-after')) ??
        DEFAULT_COOLDOWN_SECONDS;
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
          lineNumber: 151,
        },
      );
      return 'retry';
    }

    this.logger.error(
      `LLM ${label} request rejected (${status}) on ${lease.alias}: ${message}`,
      {
        fileName: 'llm-client.service.ts',
        functionName: 'handleFailure',
        lineNumber: 162,
      },
    );
    return 'fatal';
  }

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
      lineNumber: 183,
    });
    throw new AppException(AI_ERRORS.AI_INVALID_RESPONSE);
  }
}
