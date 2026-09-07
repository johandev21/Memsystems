import { describe, expect, it } from 'vitest';
import { toClientStreamError } from '../src/modules/ai/stream-error';

const MODEL = {
  id: 'anthropic/claude-fable-5.1',
  displayName: 'Claude Fable 5.1',
};

function envelopeOf(output: string): {
  error: string;
  code: string;
  model?: string;
} {
  return JSON.parse(output) as { error: string; code: string; model?: string };
}

describe('toClientStreamError', () => {
  it('passes model-substitution failures through verbatim', () => {
    const message = 'model_substituted: requested a but the gateway served b.';
    expect(toClientStreamError(new Error(message), MODEL)).toBe(message);
  });

  it('maps entitlement failures to an envelope naming the model', () => {
    const error = Object.assign(
      new Error('Free tier users do not have access'),
      {
        statusCode: 403,
      },
    );
    const parsed = envelopeOf(toClientStreamError(error, MODEL));
    expect(parsed.code).toBe('gateway_entitlement');
    expect(parsed.model).toBe('Claude Fable 5.1');
    expect(parsed.error).toContain('Claude Fable 5.1');
  });

  it('falls back to the raw model id without a display name', () => {
    const error = Object.assign(new Error('too many requests'), {
      statusCode: 429,
    });
    const parsed = envelopeOf(
      toClientStreamError(error, { id: 'openai/gpt-4o-mini' }),
    );
    expect(parsed.code).toBe('gateway_rate_limited');
    expect(parsed.model).toBe('openai/gpt-4o-mini');
    expect(parsed.error).toContain('openai/gpt-4o-mini');
  });

  it('maps auth failures without leaking details', () => {
    const error = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    const parsed = envelopeOf(toClientStreamError(error, MODEL));
    expect(parsed.code).toBe('unauthorized');
    expect(parsed.error).toContain('Claude Fable 5.1');
  });

  it('maps tool rejections to the capability envelope', () => {
    const parsed = envelopeOf(
      toClientStreamError(
        new Error('`tool_choice` did not match any supported type'),
        MODEL,
      ),
    );
    expect(parsed.code).toBe('gateway_capability_unsupported');
    expect(parsed.error).toContain('Claude Fable 5.1');
    expect(parsed.error).not.toContain('tool_choice');
  });

  it('maps retired models with matchable phrasing', () => {
    const error = Object.assign(new Error('Model not found'), {
      statusCode: 404,
    });
    const parsed = envelopeOf(toClientStreamError(error, MODEL));
    expect(parsed.error).toMatch(/retired/i);
  });

  it('maps unknown failures to a generic envelope naming the model', () => {
    const parsed = envelopeOf(
      toClientStreamError(new Error('some weird transport failure'), MODEL),
    );
    expect(parsed.code).toBe('internal_error');
    expect(parsed.model).toBe('Claude Fable 5.1');
  });

  it('never embeds raw provider text or key material', () => {
    const hostile = new Error(
      'boom sk-ant-secret1234567890 and ag_live_secret and AIzaSecret12345678901234567890123456789012',
    );
    const output = toClientStreamError(hostile, MODEL);
    expect(output).not.toContain('sk-ant-secret');
    expect(output).not.toContain('ag_live_secret');
    expect(output).not.toContain('AIzaSecret');
  });
});
