import { describe, expect, it } from 'vitest';
import {
  AGENT_KEY_PREFIX,
  agentKeyDisplayPrefix,
  generateAgentKey,
  hashAgentKey,
} from '../../src/modules/agent-access/agent-key.crypto';

describe('Agent Key material', () => {
  it('generates a prefixed 32-byte base64url key', () => {
    const key = generateAgentKey();

    expect(key.startsWith(AGENT_KEY_PREFIX)).toBe(true);
    expect(key.slice(AGENT_KEY_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateAgentKey()));
    expect(keys.size).toBe(100);
  });

  it('hashes keys as sha256 hex without keeping the plaintext', () => {
    const key = generateAgentKey();
    const hash = hashAgentKey(key);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAgentKey(key)).toBe(hash);
    expect(hash).not.toContain(key);
    expect(hashAgentKey(`${key}x`)).not.toBe(hash);
  });

  it('stores a 12-character display prefix', () => {
    const key = generateAgentKey();
    const prefix = agentKeyDisplayPrefix(key);

    expect(prefix).toHaveLength(12);
    expect(prefix).toBe(key.slice(0, 12));
    expect(prefix.startsWith(AGENT_KEY_PREFIX)).toBe(true);
  });
});
