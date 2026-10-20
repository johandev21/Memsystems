import { createHash, randomBytes } from 'node:crypto';

export const AGENT_KEY_PREFIX = 'msk_';

/** Number of leading characters stored for display (e.g. `msk_ab12cd34`). */
export const AGENT_KEY_DISPLAY_LENGTH = 12;

/**
 * Creates a new Agent Key. The plaintext is returned to the caller exactly
 * once; only `hashAgentKey()` and `agentKeyDisplayPrefix()` are persisted.
 */
export function generateAgentKey(): string {
  return `${AGENT_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashAgentKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function agentKeyDisplayPrefix(key: string): string {
  return key.slice(0, AGENT_KEY_DISPLAY_LENGTH);
}
