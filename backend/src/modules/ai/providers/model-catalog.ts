import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway';
import type { ModelCapabilities, ProviderModel } from './provider';

export const GATEWAY_DEFAULT_MODEL = 'openai/gpt-5.6-sol';
export const GATEWAY_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/**
 * Server-side fallback chain for chat requests (`providerOptions.gateway.models`).
 * When the requested model fails (rate limit, entitlement, outage), the
 * gateway transparently retries these in order. Cheap, long-lived,
 * multimodal models only — gpt-4o-mini is proven on free-tier accounts.
 */
export const GATEWAY_CHAT_FALLBACKS = [
  'openai/gpt-4o-mini',
  'google/gemini-3.6-flash',
];

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

const BASE_CHAT_CAPABILITIES: ModelCapabilities = {
  imageInput: false,
  fileInput: true,
  audioInput: false,
  tools: true,
  structuredOutput: true,
  reasoning: false,
  webSearch: true,
};

/**
 * Capability overlay for chat models. The gateway model list carries no
 * vision/audio flags, so this small pattern list is the only manually
 * maintained capability data. Everything else (availability, pricing,
 * retirements) comes from the gateway sync.
 */
export function capabilitiesForModelId(modelId: string): ModelCapabilities {
  const id = resolveModelId(modelId).toLowerCase();
  const caps: ModelCapabilities = { ...BASE_CHAT_CAPABILITIES };

  if (id.startsWith('deepseek/')) {
    caps.fileInput = false;
  }
  if (
    id.startsWith('openai/gpt-4o') ||
    id.startsWith('openai/gpt-5') ||
    /^openai\/o[134](-|$)/.test(id)
  ) {
    caps.imageInput = true;
  }
  if (/^anthropic\/claude/.test(id)) {
    caps.imageInput = true;
    caps.reasoning = true;
  }
  if (/^google\/gemini/.test(id)) {
    caps.imageInput = true;
    caps.reasoning = true;
  }
  if (/^moonshotai\/kimi/.test(id)) {
    caps.imageInput = true;
  }
  if (/meta\/llama-4-(scout|maverick)/.test(id)) {
    caps.imageInput = true;
  }
  if (
    /thinking/.test(id) ||
    /reasoning/.test(id) ||
    /deepseek-r1($|-)/.test(id) ||
    /^openai\/o[134](-|$)/.test(id) ||
    /^openai\/gpt-5/.test(id)
  ) {
    caps.reasoning = true;
  }
  return caps;
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
 * Maps one gateway metadata entry to a chat ProviderModel, or `null` when
 * the entry is not a chat-completion model. Pure function (unit-tested).
 */
export function toProviderModel(
  entry: GatewayLanguageModelEntry,
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
  return {
    id: entry.id,
    displayName: displayNameFor(entry.id, entry.name),
    supportsWebSearch: true,
    capabilities: {
      ...capabilitiesForModelId(entry.id),
      webSearch: true,
    },
    pricing,
    isFreeTier: isFreeTierModel(entry.id, pricing),
  };
}

/**
 * Builds the sorted chat catalog from gateway metadata. Pure (unit-tested).
 */
export function buildChatCatalog(
  entries: GatewayLanguageModelEntry[],
): ProviderModel[] {
  const models: ProviderModel[] = [];
  for (const entry of entries) {
    const model = toProviderModel(entry);
    if (model) models.push(model);
  }
  models.sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

function seedModel(id: string, displayName: string): ProviderModel {
  return {
    id,
    displayName,
    supportsWebSearch: true,
    capabilities: { ...capabilitiesForModelId(id), webSearch: true },
  };
}

/**
 * Curated fallback catalog used until the first successful gateway sync
 * (no API key configured, gateway unreachable, first boot). All IDs are
 * gateway-valid `creator/model` slugs.
 */
export const SEED_GATEWAY_MODELS: ProviderModel[] = [
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
