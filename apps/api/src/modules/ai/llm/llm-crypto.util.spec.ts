import { randomBytes } from 'crypto';
import {
  decryptSecret,
  encryptSecret,
  maskKey,
  parseMasterKey,
  scrubSecrets,
} from './llm-crypto.util.js';

describe('llm-crypto.util', () => {
  const masterKey = randomBytes(32);
  const plaintext = 'gsk_abcdefghijklmnopqrstuvwxyz0123456789';

  it('round-trips a key with a 12-byte IV and 16-byte auth tag', () => {
    const secret = encryptSecret(plaintext, 'llm-key-01', masterKey);
    expect(secret.iv).toHaveLength(24);
    expect(secret.auth_tag).toHaveLength(32);
    expect(secret.encrypted_key).not.toContain('abcdefgh');
    expect(decryptSecret(secret, 'llm-key-01', masterKey)).toBe(plaintext);
  });

  it('uses a fresh IV for every encryption', () => {
    const a = encryptSecret(plaintext, 'llm-key-01', masterKey);
    const b = encryptSecret(plaintext, 'llm-key-01', masterKey);
    expect(a.iv).not.toBe(b.iv);
    expect(a.encrypted_key).not.toBe(b.encrypted_key);
  });

  it('rejects a tampered ciphertext', () => {
    const secret = encryptSecret(plaintext, 'llm-key-01', masterKey);
    const flipped =
      (parseInt(secret.encrypted_key[0], 16) ^ 1).toString(16) +
      secret.encrypted_key.slice(1);
    expect(() =>
      decryptSecret(
        { ...secret, encrypted_key: flipped },
        'llm-key-01',
        masterKey,
      ),
    ).toThrow();
  });

  it('rejects a tampered auth tag', () => {
    const secret = encryptSecret(plaintext, 'llm-key-01', masterKey);
    const tag = secret.auth_tag.startsWith('0')
      ? `1${secret.auth_tag.slice(1)}`
      : `0${secret.auth_tag.slice(1)}`;
    expect(() =>
      decryptSecret({ ...secret, auth_tag: tag }, 'llm-key-01', masterKey),
    ).toThrow();
  });

  it('rejects a ciphertext copied onto another alias', () => {
    const secret = encryptSecret(plaintext, 'llm-key-01', masterKey);
    expect(() => decryptSecret(secret, 'llm-key-02', masterKey)).toThrow();
  });

  it('rejects the wrong master key', () => {
    const secret = encryptSecret(plaintext, 'llm-key-01', masterKey);
    expect(() =>
      decryptSecret(secret, 'llm-key-01', randomBytes(32)),
    ).toThrow();
  });

  it('only accepts a 64-hex-character master key', () => {
    expect(parseMasterKey('a'.repeat(64))).toHaveLength(32);
    expect(() => parseMasterKey(undefined)).toThrow();
    expect(() => parseMasterKey('a'.repeat(63))).toThrow();
    expect(() => parseMasterKey('z'.repeat(64))).toThrow();
  });

  it('masks keys and scrubs them from text', () => {
    expect(maskKey(plaintext)).toBe('gsk_...6789');
    expect(scrubSecrets(`bad key ${plaintext} used`)).toBe(
      'bad key gsk_*** used',
    );
  });
});
