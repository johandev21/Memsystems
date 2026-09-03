import { createGateway, gateway as defaultGateway } from '@ai-sdk/gateway';
import { generateText, type JSONValue } from 'ai';
import { GATEWAY_DEFAULT_MODEL } from './model-catalog';
import { classifyGatewayError } from './gateway-errors';
import type { HealthCheckResult, Provider, ProviderModel } from './provider';

// NOTE on the `ai` version pin (backend/package.json pins ai to exactly
// 7.0.91): ai@7.0.92 shipped with a typo in addLanguageModelUsage
// (`usage.outputTokenDetails.outputTokenDetails.reasoningTokens`, one level
// too deep) that crashes every generateText/streamText call, and the 7.0.92
// tarball was republished in place so the version cannot be trusted.
// Do NOT float `ai` back to ^7.0.92. Re-evaluate once upstream publishes a
// fixed release (7.0.93+) and re-run the live inference test.

/**
 * Optional server gateway key, used ONLY for background model-catalog syncs
 * (startup/cron) that run without a user context. Inference and embeddings
 * always use the requesting user's own key from UserSettingsService.
 */
export function gatewayServerKey(): string | null {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  return key ? key : null;
}

export interface GatewayRequestOptions {
  providerOptions: { gateway: Record<string, JSONValue> };
}

/**
 * Builds per-request gateway options: the end-user id for spend attribution
 * plus an optional server-side fallback model chain. Auth travels with the
 * provider instance (each user's own gateway key), not the options bag. The
 * bag stays plain JSON so it satisfies the AI SDK provider-options type at
 * every call site.
 */
export function buildGatewayOptions(
  userId?: string,
  fallbacks?: string[],
): GatewayRequestOptions {
  const gateway: Record<string, JSONValue> = {};
  if (userId) gateway.user = userId;
  if (fallbacks && fallbacks.length > 0) gateway.models = [...fallbacks];
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
    // Gateway-executed search tools work with any catalog model.
    supportsWebSearch: () => true,
    createWebSearchTool: () =>
      gateway.tools.perplexitySearch({ maxResults: 8 }),
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
  // With an account key, a metadata call proves auth + reachability without
  // spending inference quota. Without one (OIDC environments), fall back to
  // a tiny inference probe.
  if (apiKey) {
    try {
      await gateway.getAvailableModels();
      return { ok: true };
    } catch (error) {
      return classifiedProbeResult(error);
    }
  }
  // Probe cheap, long-lived models: the default may not be entitled on
  // free-tier accounts, but any success proves the credential reaches the
  // gateway. Failures are not billed.
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
