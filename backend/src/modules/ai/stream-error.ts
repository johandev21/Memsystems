import {
  classifyGatewayError,
  type GatewayFailureKind,
} from './providers/gateway-errors';

export interface StreamErrorModel {
  id: string;
  displayName?: string | null;
}

const SUBSTITUTION_PREFIX = 'model_substituted:';

const CODE_BY_KIND: Record<GatewayFailureKind, string> = {
  auth: 'unauthorized',
  entitlement: 'gateway_entitlement',
  rate_limited: 'gateway_rate_limited',
  retired: 'service_unavailable',
  capability: 'gateway_capability_unsupported',
  transient: 'service_unavailable',
  unknown: 'internal_error',
};

function displayNameOf(model: StreamErrorModel): string {
  return model.displayName?.trim() ? model.displayName.trim() : model.id;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function envelope(error: string, code: string, model: string): string {
  return JSON.stringify({ error, code, model });
}

/**
 * Maps a failed model-call error to the client-facing string for AI SDK
 * `toUIMessageStreamResponse({ onError })` and similar surfaces. The SDK
 * masks raw server errors ("An error occurred.") by default, which the
 * frontend cannot classify — so this always returns a
 * `{error, code[, model]}` JSON envelope the `classifyChatError` rules
 * understand, or passes model-substitution failures through verbatim.
 *
 * Curated messages only: raw provider text never reaches the client, so
 * URLs, key fragments, and gateway internals cannot leak. Every message is
 * phrased to also match the frontend text rules as a second layer.
 */
export function toClientStreamError(
  error: unknown,
  model: StreamErrorModel,
): string {
  const message = messageOf(error);
  if (message.startsWith(SUBSTITUTION_PREFIX)) return message;
  const name = displayNameOf(model);

  const classified = classifyGatewayError(error);
  switch (classified.kind) {
    case 'capability':
      return envelope(
        `${name} doesn't support tools. Switch to a model that supports web search and try again.`,
        CODE_BY_KIND.capability,
        name,
      );
    case 'auth':
      return envelope(
        `Gateway authentication failed for ${name} — your key was rejected. Check your key in Settings.`,
        CODE_BY_KIND.auth,
        name,
      );
    case 'entitlement':
      return envelope(
        `${name} is not available on your gateway plan — you do not have access to this model. Try a free-tier model or add credits.`,
        CODE_BY_KIND.entitlement,
        name,
      );
    case 'rate_limited':
      return envelope(
        `${name} is rate-limited on your plan. Wait a few seconds and retry, or switch to another model.`,
        CODE_BY_KIND.rate_limited,
        name,
      );
    case 'retired':
      return envelope(
        `${name} was retired from the gateway. Pick a current model and retry.`,
        CODE_BY_KIND.retired,
        name,
      );
    case 'transient':
    case 'unknown':
    default:
      return envelope(
        'The request failed before finishing. Retrying usually works.',
        CODE_BY_KIND.unknown,
        name,
      );
  }
}
