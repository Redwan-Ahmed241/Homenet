import type {
  LlmMessage,
  LlmProviderClient,
  LlmReasoningEffort,
} from '../llm.types.js';

export interface LlmChatRequest {
  model: string;
  messages: LlmMessage[];
  temperature: number;
  maxTokens: number;
  reasoningEffort?: LlmReasoningEffort;
}

export interface LlmChatResult {
  content: string | null | undefined;
  /** Response headers; `x-ratelimit-remaining-requests` / `x-ratelimit-reset-requests` drive the soft limit. */
  headers: Headers;
}

export interface LlmErrorInfo {
  /** HTTP status from the provider; undefined for timeouts and network errors. */
  status?: number;
  retryAfter?: string | null;
}

/**
 * The only vendor-specific part of the LLM stack. Key storage, rotation and the
 * circuit breaker are shared; switching vendor means implementing this interface
 * and changing the LLM_PROVIDER binding in LlmModule.
 */
export interface ILlmProvider {
  /** Builds an SDK client for one API key with SDK-level retries disabled. */
  createClient(apiKey: string): LlmProviderClient;
  /** Runs one JSON-mode chat completion with no retries. */
  chatJson(
    client: LlmProviderClient,
    request: LlmChatRequest,
    timeoutMs: number,
  ): Promise<LlmChatResult>;
  /** Extracts the HTTP status and retry-after header from a failed call. */
  getErrorInfo(error: unknown): LlmErrorInfo;
}
