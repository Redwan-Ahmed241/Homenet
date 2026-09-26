import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// No local imports here: scripts/seed-llm-keys.ts loads this file directly through ts-node.

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const GROQ_KEY_PATTERN = /gsk_[A-Za-z0-9]{8,}/g;

export interface EncryptedSecret {
  encrypted_key: string;
  iv: string;
  auth_tag: string;
}

export function parseMasterKey(hex: string | undefined): Buffer {
  const value = hex?.trim() ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      'LLM_MASTER_ENCRYPTION_KEY must be 64 hex characters (32 bytes)',
    );
  }
  return Buffer.from(value, 'hex');
}

// The alias is bound as additional authenticated data, so a ciphertext copied onto another row fails to decrypt.
export function encryptSecret(
  plaintext: string,
  alias: string,
  masterKey: Buffer,
): EncryptedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(alias, 'utf8'));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    encrypted_key: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    auth_tag: cipher.getAuthTag().toString('hex'),
  };
}

export function decryptSecret(
  secret: EncryptedSecret,
  alias: string,
  masterKey: Buffer,
): string {
  const iv = Buffer.from(secret.iv, 'hex');
  const authTag = Buffer.from(secret.auth_tag, 'hex');
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error(`Malformed IV or auth tag for key "${alias}"`);
  }

  const decipher = createDecipheriv(ALGORITHM, masterKey, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAAD(Buffer.from(alias, 'utf8'));
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(Buffer.from(secret.encrypted_key, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskKey(key: string): string {
  return key.length > 12 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '****';
}

export function scrubSecrets(text: string): string {
  return text.replace(GROQ_KEY_PATTERN, 'gsk_***');
}
