import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptApiKey,
  encryptApiKey,
  getEncryptionSecret,
  isEncryptedPayload,
} from '../src/modules/ai/key-encryption';

const TEST_SECRET =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('key-encryption', () => {
  const previous = process.env.CREDENTIALS_ENCRYPTION_KEY;

  afterEach(() => {
    if (previous === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = previous;
  });

  it('round-trips a key and produces versioned payloads', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_SECRET;
    const encrypted = encryptApiKey('ag_live_secret');
    expect(isEncryptedPayload(encrypted)).toBe(true);
    expect(encrypted).not.toContain('ag_live_secret');
    expect(decryptApiKey(encrypted)).toBe('ag_live_secret');
  });

  it('uses a fresh IV per encryption', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_SECRET;
    expect(encryptApiKey('same')).not.toBe(encryptApiKey('same'));
  });

  it('rejects decryption with the wrong secret', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_SECRET;
    const encrypted = encryptApiKey('ag_live_secret');
    process.env.CREDENTIALS_ENCRYPTION_KEY =
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    expect(() => decryptApiKey(encrypted)).toThrow();
  });

  it('rejects malformed payloads and plaintext', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_SECRET;
    expect(isEncryptedPayload('sk-plaintext')).toBe(false);
    expect(() => decryptApiKey('sk-plaintext')).toThrow();
    expect(() => decryptApiKey('v1.bad.payload')).toThrow();
  });

  it('throws a helpful error without a configured secret', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => getEncryptionSecret()).toThrow(
      /CREDENTIALS_ENCRYPTION_KEY is not configured/,
    );
    expect(() => encryptApiKey('x')).toThrow(
      /CREDENTIALS_ENCRYPTION_KEY is not configured/,
    );
  });

  it('derives a key from a passphrase secret', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'dev-only-passphrase';
    const encrypted = encryptApiKey('ag_live_secret');
    expect(decryptApiKey(encrypted)).toBe('ag_live_secret');
  });
});
