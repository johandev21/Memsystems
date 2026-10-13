import { createGateway, gateway as defaultGateway } from '@ai-sdk/gateway';
import { generateText, type JSONValue } from 'ai';
import { GATEWAY_DEFAULT_MODEL, resolveModelId } from './model-catalog';
import { classifyGatewayError } from './gateway-errors';
import type { HealthCheckResult, Provider, ProviderModel } from './provider';

export function gatewayServerKey(): string | null {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  return key ? key : null;
}

export interface GatewayRequestOptions {
  providerOptions: { gateway: Record<string, JSONValue> };
}

export const SINGLE_USER_ID = 'single-user';

export function buildGatewayOptions(userId?: string): GatewayRequestOptions {
  const gateway: Record<string, JSONValue> = {};
  if (userId) gateway.user = userId;
  return { providerOptions: { gateway } };
}

export function createGatewayProvider(deps: {
  apiKey?: string | null;
  getModels: () => ProviderModel[];
  requestOptions?: GatewayRequestOptions;
}): Provider {
  const gateway = deps.apiKey
    ? createGateway({ apiKey: deps.apiKey })
    : defaultGateway;
  const options: GatewayRequestOptions = deps.requestOptions ?? {
    providerOptions: { gateway: {} },
  };
  return {
    id: 'gateway',
    name: 'AI Gateway',
    listModels: () => deps.getModels(),
    createModel: (modelId) => gateway(modelId),
    supportsWebSearch: (modelId) => {
      const resolved = resolveModelId(modelId);
      const model = deps
        .getModels()
        .find((candidate) => candidate.id === resolved);
      return model?.capabilities?.webSearch === true;
    },
    createWebSearchTool: () =>
      gateway.tools.perplexitySearch({ maxResults: 20 }),
    health: async (requestOptions?: GatewayRequestOptions) => {
      const health = await probeGateway(
        gateway,
        deps.apiKey ?? null,
        requestOptions ?? options,
      );
      return health;
    },
  };
}

async function probeGateway(
  gateway: ReturnType<typeof createGateway>,
  apiKey: string | null,
  options: GatewayRequestOptions,
): Promise<HealthCheckResult> {
  if (apiKey) {
    try {
      await gateway.getAvailableModels();
      return { ok: true };
    } catch (error) {
      return classifiedProbeResult(error);
    }
  }
  const candidates = [
    GATEWAY_DEFAULT_MODEL,
    'openai/gpt-4o-mini',
    'anthropic/claude-haiku-4.5',
  ];
  let lastError: unknown = null;
  for (const modelId of candidates) {
    try {
      await generateText({
        model: gateway(modelId),
        prompt: 'Reply with OK.',
        maxOutputTokens: 16,
        ...options,
      });
      return { ok: true };
    } catch (error) {
      lastError = error;
    }
  }
  return classifiedProbeResult(lastError);
}

function classifiedProbeResult(error: unknown): HealthCheckResult {
  const classified = classifyGatewayError(error);
  if (classified.kind === 'auth') {
    return { ok: false, detail: classified.detail };
  }
  return {
    ok: false,
    degraded: true,
    detail: classified.detail,
  };
}
