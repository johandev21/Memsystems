import { describe, expect, it } from 'vitest';
import { redactAgentAuditArgs } from '../../src/modules/agent-access/agent-audit.service';

describe('Agent Audit Log redaction', () => {
  it('replaces bulky payloads with their character count', () => {
    const redacted = redactAgentAuditArgs({
      text: 'hello',
      rawText: 'abc',
      contentBase64: 'AAAA',
      transcript: 'a longer transcript',
      keep: 'this stays',
      count: 3,
    });

    expect(redacted).toEqual({
      text: '[redacted 5 chars]',
      rawText: '[redacted 3 chars]',
      contentBase64: '[redacted 4 chars]',
      transcript: '[redacted 19 chars]',
      keep: 'this stays',
      count: 3,
    });
  });

  it('redacts nested keys, arrays, and entire content objects', () => {
    const redacted = redactAgentAuditArgs({
      messages: [
        { role: 'user', text: 'Explain Plato' },
        { role: 'assistant', content: [{ type: 'text', text: 'Plato...' }] },
      ],
      content: { type: 'quiz', questions: [1, 2, 3] },
    });

    const messages = redacted.messages as Array<Record<string, unknown>>;
    expect(messages[0]).toEqual({
      role: 'user',
      text: '[redacted 13 chars]',
    });
    expect(messages[1]?.content).toMatch(/^\[redacted \d+ chars\]$/);

    // The whole `content` property is redacted, not just its `text` leaf.
    expect(redacted.content).toMatch(/^\[redacted \d+ chars\]$/);
    expect(JSON.stringify(redacted)).not.toContain('questions');
  });

  it('returns an empty object for missing arguments', () => {
    expect(redactAgentAuditArgs(null)).toEqual({});
    expect(redactAgentAuditArgs(undefined)).toEqual({});
  });

  it('preserves primitive values and booleans', () => {
    expect(
      redactAgentAuditArgs({
        notebookId: 'notebook_1',
        permanent: true,
        limit: 10,
        missing: null,
      }),
    ).toEqual({
      notebookId: 'notebook_1',
      permanent: true,
      limit: 10,
      missing: null,
    });
  });
});
