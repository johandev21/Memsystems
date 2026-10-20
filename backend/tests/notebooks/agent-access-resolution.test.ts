import { describe, expect, it } from 'vitest';
import { resolveAgentAccess } from '../../src/modules/notebooks/agent-access';

describe('Notebook Agent Access resolution', () => {
  it('uses the workspace default when the Notebook inherits', () => {
    expect(resolveAgentAccess(null, 'read_only')).toBe('read_only');
    expect(resolveAgentAccess(undefined, 'off')).toBe('off');
  });

  it('prefers the Notebook override over the workspace default', () => {
    expect(resolveAgentAccess('on', 'off')).toBe('on');
    expect(resolveAgentAccess('read_only', 'on')).toBe('read_only');
    expect(resolveAgentAccess('off', 'on')).toBe('off');
  });
});
