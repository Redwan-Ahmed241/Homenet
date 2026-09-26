import type Groq from 'groq-sdk';

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
  client: Groq | null;
}

export interface KeyLease extends VaultKey {
  client: Groq;
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

export interface ChatJsonOptions {
  label: string;
  model: string;
  messages: LlmMessage[];
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}
