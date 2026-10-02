import { Injectable } from '@nestjs/common';
import Groq, { APIError } from 'groq-sdk';
import type {
  ILlmProvider,
  LlmChatRequest,
  LlmChatResult,
  LlmErrorInfo,
} from '../interfaces/llm-provider.interface.js';
import type { LlmProviderClient } from '../llm.types.js';

@Injectable()
export class GroqLlmProvider implements ILlmProvider {
  /** Creates a Groq client with SDK retries disabled; rotation handles failover instead. */
  createClient(apiKey: string): LlmProviderClient {
    return new Groq({ apiKey, maxRetries: 0 });
  }

  /** Runs one Groq JSON-mode chat completion and returns the content with its rate-limit headers. */
  async chatJson(
    client: LlmProviderClient,
    request: LlmChatRequest,
    timeoutMs: number,
  ): Promise<LlmChatResult> {
    const { data, response } = await (client as Groq).chat.completions
      .create(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          max_completion_tokens: request.maxTokens,
          response_format: { type: 'json_object' },
          // Only sent when configured; non-reasoning models reject the field.
          ...(request.reasoningEffort && {
            reasoning_effort: request.reasoningEffort,
          }),
        },
        {
          timeout: timeoutMs,
          maxRetries: 0,
        },
      )
      .withResponse();

    return {
      content: data.choices[0]?.message?.content,
      headers: response.headers,
    };
  }

  /** Reads status and retry-after from Groq SDK errors; timeouts and network errors have no status. */
  getErrorInfo(error: unknown): LlmErrorInfo {
    if (!(error instanceof APIError)) return {};
    const headers: unknown = error.headers;
    return {
      status: error.status as number | undefined,
      retryAfter:
        headers instanceof Headers ? headers.get('retry-after') : null,
    };
  }
}
