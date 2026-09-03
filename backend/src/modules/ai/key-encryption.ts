import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const PAYLOAD_PREFIX = 'v1';
const IV_BYTES = 12;

/**
 * At-rest encryption for per-user gateway keys (AES-256-GCM).
 *
 * `CREDENTIALS_ENCRYPTION_KEY` accepts a 64-char hex string, a base64
 * 32-byte key, or any passphrase (SHA-256 derived — fine for dev, use a
 * generated hex key in production). Stored payloads look like
 * `v1.<iv-b64>.<tag-b64>.<ciphertext-b64>`.
 */
export function getEncryptionSecret(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is not configured. Generate one with: ' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall through to passphrase derivation.
  }
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionSecret();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PAYLOAD_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function isEncryptedPayload(value: string): boolean {
  return (
    value.startsWith(`${PAYLOAD_PREFIX}.`) && value.split('.').length === 4
  );
}

export function decryptApiKey(payload: string): string {
  const key = getEncryptionSecret();
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== PAYLOAD_PREFIX) {
    throw new Error('Unrecognized encrypted key format.');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');
  if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Unrecognized encrypted key format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}
