import { describe, expect, it } from 'vitest';
import { classifyGatewayError } from '../src/modules/ai/providers/gateway-errors';

function gatewayError(
  name: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return Object.assign(new Error(message), { name, ...extra });
}

describe('classifyGatewayError', () => {
  it('unwraps AI SDK retry wrappers to the last error', () => {
    const lastError = gatewayError(
      'GatewayRateLimitError',
      'Free tier requests on this model are rate-limited.',
      { statusCode: 429, isRetryable: true },
    );
    const wrapped = Object.assign(
      new Error(`Failed after 3 attempts. Last error: ${lastError.message}`),
      { name: 'AI_RetryError', lastError },
    );
    expect(classifyGatewayError(wrapped).kind).toBe('rate_limited');
  });

  it('detects auth failures', () => {
    expect(
      classifyGatewayError(
        gatewayError('GatewayAuthenticationError', 'Invalid API key', {
          statusCode: 401,
        }),
      ).kind,
    ).toBe('auth');
  });

  it('detects entitlement gaps', () => {
    expect(
      classifyGatewayError(
        gatewayError(
          'GatewayForbiddenError',
          'Free tier users do not have access to this model.',
          { statusCode: 403 },
        ),
      ).kind,
    ).toBe('entitlement');
  });

  it('detects retired models', () => {
    expect(
      classifyGatewayError(
        gatewayError('GatewayModelNotFoundError', 'Model not found', {
          statusCode: 404,
        }),
      ).kind,
    ).toBe('retired');
  });

  it('detects transient failures', () => {
    expect(
      classifyGatewayError(
        gatewayError('GatewayInternalServerError', 'Internal error', {
          statusCode: 500,
          isRetryable: true,
        }),
      ),
    ).toMatchObject({ kind: 'transient', retryable: true });
  });

  it.each([
    ['tool_choice did not match any supported type'],
    ['Tool choice `web_search_preview` not found in `tools` parameter.'],
    ['This model does not support tools or function calling'],
    ['Unsupported tool: web_search'],
  ])('detects capability rejections: %s', (message) => {
    expect(classifyGatewayError(new Error(message))).toMatchObject({
      kind: 'capability',
      retryable: false,
    });
  });

  it('falls back to unknown without crashing on odd shapes', () => {
    expect(classifyGatewayError(null).kind).toBe('unknown');
    expect(classifyGatewayError('plain string').kind).toBe('unknown');
    expect(classifyGatewayError(new Error('weird')).kind).toBe('unknown');
  });
});
