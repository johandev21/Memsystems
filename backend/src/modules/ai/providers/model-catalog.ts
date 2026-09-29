import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway';
import type { ModelCapabilities, ProviderModel } from './provider';

export const GATEWAY_DEFAULT_MODEL = 'openai/gpt-5.6-sol';

/**
 * Stale model IDs (persisted in localStorage/DB or sent by old clients) and
 * their gateway replacements. Applied by resolveModelId() before validation.
 */
export const MODEL_ID_ALIASES: Record<string, string> = {
  'kimi/kimi-k3': 'moonshotai/kimi-k3',
  'kimi/kimi-k2.6': 'moonshotai/kimi-k2.6',
  'deepseek/deepseek-v3': 'deepseek/deepseek-v3.2',
  'google/gemini-3.6-pro': 'google/gemini-2.5-pro',
  'google/gemini-3.6-thinking': 'google/gemini-3.8-flash',
};

export function resolveModelId(modelId: string): string {
  return MODEL_ID_ALIASES[modelId] ?? modelId;
}

/** Gateway creator prefix of a `creator/model` id (`null` when malformed). */
export function creatorFromModel(modelId: string): string | null {
  const resolved = resolveModelId(modelId);
  const slash = resolved.indexOf('/');
  if (slash <= 0) return null;
  return resolved.slice(0, slash);
}

/**
 * One entry of the Gateway public model list (`GET /v1/models`), the only
 * capability source. The documented shape carries `tags` (union of the
 * model's active provider endpoints) and `supported_parameters`; everything
 * else is ignored here.
 */
export interface GatewayPublicModel {
  id: string;
  name?: string | null;
  type?: string | null;
  tags?: string[] | null;
  supported_parameters?: string[] | null;
}

/**
 * Maps one Gateway public-list entry to the seven Model Capabilities.
 * Tags are the primary signal; `supported_parameters` corroborates the two
 * capabilities that have a reliable parameter spelling (`tools`,
 * `structured_outputs`/`response_format`). Absent tags mean the capability
 * is not claimed (fail closed).
 */
export function capabilitiesFromPublicModel(
  entry: GatewayPublicModel,
): ModelCapabilities {
  const tags = new Set(entry.tags ?? []);
  const parameters = new Set(entry.supported_parameters ?? []);
  return {
    imageInput: tags.has('vision'),
    fileInput: tags.has('file-input'),
    audioInput: tags.has('audio-input'),
    tools: tags.has('tool-use') || parameters.has('tools'),
    structuredOutput:
      tags.has('structured-output') ||
      parameters.has('structured_outputs') ||
      parameters.has('response_format'),
    reasoning: tags.has('reasoning'),
    webSearch: tags.has('web-search'),
  };
}

/**
 * Capability lookup keyed by resolved model id, built from the Gateway public
 * list. Only models present in the list get claims; the overlay is passed to
 * buildChatCatalog() during a verified sync.
 */
export function buildCapabilityOverlay(
  entries: readonly GatewayPublicModel[],
): Map<string, ModelCapabilities> {
  const overlay = new Map<string, ModelCapabilities>();
  for (const entry of entries) {
    overlay.set(resolveModelId(entry.id), capabilitiesFromPublicModel(entry));
  }
  return overlay;
}

/**
 * Slug fragments identifying non-chat modalities. Only used as a fallback
 * when a gateway entry has no `modelType` discriminator.
 */
const NON_CHAT_SLUG_PATTERNS = [
  '-image',
  'image-',
  'transcribe',
  'embedding',
  '-embed',
  'embed-',
  '/tts',
  'tts-',
  '-tts',
  'stt',
  '/veo',
  'veo-',
  'video',
  'imagine',
  'realtime',
  'whisper',
  'voice-',
  '-voice',
  '/flux-',
  '/recraft',
  '/seedance',
  '/kling-v',
  '/wan-2',
  '/wan-3',
  't2v',
  'i2v',
  'r2v',
];

function isChatModelId(id: string): boolean {
  const lower = id.toLowerCase();
  return !NON_CHAT_SLUG_PATTERNS.some((pattern) => lower.includes(pattern));
}

function parsePrice(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pricingFor(
  entry: GatewayLanguageModelEntry,
): { input: number; output: number } | null {
  const input = parsePrice(entry.pricing?.input);
  const output = parsePrice(entry.pricing?.output);
  if (input === null || output === null) return null;
  return { input, output };
}

function isFreeTierModel(
  id: string,
  pricing: { input: number; output: number } | null,
): boolean {
  if (id.toLowerCase().includes('-free')) return true;
  return pricing !== null && pricing.input === 0 && pricing.output === 0;
}

function displayNameFor(id: string, gatewayName?: string | null): string {
  if (gatewayName?.trim()) return gatewayName.trim();
  const slug = id.includes('/') ? id.slice(id.indexOf('/') + 1) : id;
  return slug
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((token) =>
      /^\d/.test(token) ? token : token[0].toUpperCase() + token.slice(1),
    )
    .join(' ');
}

/**
 * GatewayLanguageModelEntry findings (@ai-sdk/gateway, inspected in
 * backend/node_modules/@ai-sdk/gateway/dist/index.d.ts):
 * `{ id: string; name: string; description?: string | null;
 *    pricing?: { input: string; output: string;
 *      cachedInputTokens?: string; cacheCreationInputTokens?: string } | null;
 *    specification: Pick<LanguageModelV4,
 *      'specificationVersion' | 'provider' | 'modelId'>;
 *    modelType?: KnownModelType | null }`
 * where KnownModelType = 'embedding' | 'image' | 'language' | 'realtime' |
 * 'reranking' | 'speech' | 'transcription' | 'video'.
 * The SDK catalog carries NO capability flags (its zod schema strips tags),
 * so capabilities are merged in separately from the REST public list; see
 * ModelSyncService. Chat, pricing and availability still come from here.
 * Creator prefixes observed in the GatewayModelId union (~256 models):
 * alibaba, amazon, anthropic, bytedance, cohere, deepseek, google, inception,
 * inclusionai, interfaze, kwaipilot, meta, minimax, mistral, moonshotai,
 * morph, nvidia, openai, perplexity, poolside, sakana, spacexai, stepfun,
 * tencent, thinkingmachines, xiaomi, zai (plus legacy `xai`, `zhipu`,
 * `zhipuai`, `qwen`, `kimi` aliases remapped via MODEL_ID_ALIASES).
 *
 * Maps one gateway metadata entry to a chat ProviderModel, or `null` when
 * the entry is not a chat-completion model. Pure function (unit-tested).
 *
 * `capabilities` is the overlay built from the Gateway public list for this
 * model id. When it is missing (public list unavailable, model absent from
 * the list) the model carries no capability claims at all.
 */
export function toProviderModel(
  entry: GatewayLanguageModelEntry,
  capabilities?: ModelCapabilities | null,
): ProviderModel | null {
  if (
    entry.modelType !== undefined &&
    entry.modelType !== null &&
    entry.modelType !== 'language'
  ) {
    return null;
  }
  if (!isChatModelId(entry.id)) return null;
  const pricing = pricingFor(entry);
  const model: ProviderModel = {
    id: entry.id,
    displayName: displayNameFor(entry.id, entry.name),
    pricing,
    isFreeTier: isFreeTierModel(entry.id, pricing),
  };
  if (capabilities) {
    model.capabilities = capabilities;
    model.supportsWebSearch = capabilities.webSearch === true;
  }
  return model;
}

/**
 * Builds the sorted chat catalog from gateway metadata. Pure (unit-tested).
 * Capabilities are applied from the optional Gateway-public-list overlay,
 * keyed by resolved id; entries without an overlay get no claims.
 */
export function buildChatCatalog(
  entries: GatewayLanguageModelEntry[],
  capabilityOverlay?: ReadonlyMap<string, ModelCapabilities>,
): ProviderModel[] {
  const models: ProviderModel[] = [];
  for (const entry of entries) {
    const model = toProviderModel(
      entry,
      capabilityOverlay?.get(resolveModelId(entry.id)) ?? null,
    );
    if (model) models.push(model);
  }
  models.sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

function seedModel(id: string, displayName: string): ProviderModel {
  // Seeds carry no capability claims: the Gateway public list is the only
  // authority and a seed catalog was never verified against it.
  return { id, displayName };
}

/**
 * Curated fallback catalog used until the first successful gateway sync
 * (no API key configured, gateway unreachable, first boot). All IDs are
 * gateway-valid `creator/model` slugs.
 * Freshness verified against the GatewayModelId union in
 * @ai-sdk/gateway (dist/index.d.ts): GATEWAY_DEFAULT_MODEL
 * (`openai/gpt-5.6-sol`) and every seed slug below are present, so no
 * seed update is needed at this time.
 */
export const SEED_GATEWAY_MODELS: ProviderModel[] = [
  seedModel('openai/gpt-4o-mini', 'GPT-4o Mini'),
  seedModel('openai/gpt-5.6-sol', 'GPT-5.6 Sol'),
  seedModel('openai/gpt-5.6-terra', 'GPT-5.6 Terra'),
  seedModel('openai/gpt-5.6-luna', 'GPT-5.6 Luna'),
  seedModel('openai/gpt-5.5', 'GPT-5.5'),
  seedModel('openai/gpt-5.5-pro', 'GPT-5.5 Pro'),
  seedModel('deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash'),
  seedModel('deepseek/deepseek-v3.2', 'DeepSeek V3.2'),
  seedModel('deepseek/deepseek-r1', 'DeepSeek R1'),
  seedModel('anthropic/claude-sonnet-5', 'Claude Sonnet 5'),
  seedModel('anthropic/claude-opus-4.8', 'Claude Opus 4.8'),
  seedModel('google/gemini-3.6-flash', 'Gemini 3.6 Flash'),
  seedModel('google/gemini-2.5-pro', 'Gemini 2.5 Pro'),
  seedModel('moonshotai/kimi-k3', 'Kimi K3'),
  seedModel('moonshotai/kimi-k2.6', 'Kimi K2.6'),
];
