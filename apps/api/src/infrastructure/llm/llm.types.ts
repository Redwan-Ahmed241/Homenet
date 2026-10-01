/** SDK client built by the active ILlmProvider; opaque to everything else. */
export type LlmProviderClient = object;

export const LLM_KEY_STATUS = {
  ACTIVE: 'ACTIVE',
  COOLDOWN: 'COOLDOWN',
  REVOKED: 'REVOKED',
} as const;

export interface VaultKey {
  id: string;
  alias: string;
  accountId: string;
  maskedKey: string;
  /** null when the stored ciphertext failed authentication; the slot is kept so the ring stays aligned. */
  client: LlmProviderClient | null;
}

export interface KeyLease extends VaultKey {
  client: LlmProviderClient;
}

export interface SharedRotationState {
  counter: number;
  cooledAccounts: Set<string>;
  revokedKeyIds: Set<string>;
  fingerprint: string;
}

export interface LlmMessage {
  role: 'system' | 'user';
  content: string;
}

const LLM_REASONING_EFFORTS = ['none', 'low', 'medium', 'high'] as const;

/** How much hidden reasoning a reasoning model may do; those tokens count against maxTokens. */
export type LlmReasoningEffort = (typeof LLM_REASONING_EFFORTS)[number];

/** Reads LLM_REASONING_EFFORT; unset or unknown values return undefined so the field is not sent. */
export function parseReasoningEffort(
  value: string | undefined,
): LlmReasoningEffort | undefined {
  const effort = value?.trim().toLowerCase();
  return LLM_REASONING_EFFORTS.find((e) => e === effort);
}

export interface ChatJsonOptions {
  label: string;
  model: string;
  messages: LlmMessage[];
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  /** Omitted for models without reasoning support. */
  reasoningEffort?: LlmReasoningEffort;
}
