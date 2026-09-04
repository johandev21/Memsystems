import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway';
import type { ModelCapabilities, ProviderModel } from './provider';

export const GATEWAY_DEFAULT_MODEL = 'openai/gpt-5.6-sol';
export const GATEWAY_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

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

const FAIL_CLOSED_CAPABILITIES: Required<ModelCapabilities> = {
  imageInput: false,
  fileInput: false,
  audioInput: false,
  tools: false,
  structuredOutput: false,
  reasoning: false,
  webSearch: false,
};

interface CapabilityRule {
  /** Human-readable identifier used when extending or reviewing this table. */
  family: string;
  matches: RegExp;
  capabilities: Partial<Required<ModelCapabilities>>;
}

/**
 * Curated model-family knowledge. Rules are applied top-to-bottom, allowing a
 * narrow rule to override a creator/family default. Web search uses a gateway
 * tool, so it is advertised only for families with known tool-call support.
 * Unknown/new families remain usable for plain chat but advertise no optional
 * capabilities until explicitly reviewed here.
 */
export const MODEL_CAPABILITY_RULES: readonly CapabilityRule[] = [
  {
    family: 'OpenAI modern GPT and o-series',
    matches: /^openai\/(?:gpt-(?:4|5)|o[134](?:-|$))/,
    capabilities: {
      imageInput: true,
      fileInput: true,
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'OpenAI reasoning models',
    matches: /^openai\/(?:gpt-5|o[134](?:-|$))/,
    capabilities: { reasoning: true },
  },
  {
    family: 'Anthropic Claude',
    matches: /^anthropic\/claude/,
    capabilities: {
      imageInput: true,
      fileInput: true,
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'Anthropic extended-thinking models',
    matches: /^anthropic\/claude-(?:3-7|(?:sonnet|opus)-(?:4|5))/,
    capabilities: { reasoning: true },
  },
  {
    family: 'Google Gemini',
    matches: /^google\/gemini/,
    capabilities: {
      imageInput: true,
      fileInput: true,
      audioInput: true,
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'Google Gemini thinking models',
    matches: /^google\/gemini-(?:2\.5|3|.*thinking)/,
    capabilities: { reasoning: true },
  },
  {
    family: 'DeepSeek V3/V4 chat',
    matches: /^deepseek\/deepseek-v[34]/,
    capabilities: {
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'DeepSeek V4 reasoning',
    matches: /^deepseek\/deepseek-v4/,
    capabilities: { reasoning: true },
  },
  {
    family: 'DeepSeek reasoning',
    matches:
      /^deepseek\/(?:deepseek-)?r1(?:-|$)|^deepseek\/.*(?:thinking|reasoning)/,
    capabilities: { reasoning: true },
  },
  {
    family: 'Moonshot Kimi K2+',
    matches: /^moonshotai\/kimi-k(?:2|3)/,
    capabilities: {
      imageInput: true,
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'Meta Llama tool-use families',
    matches: /^meta\/llama-(?:3\.1|3\.2|3\.3|4)-.*(?:instruct|scout|maverick)/,
    capabilities: { tools: true, webSearch: true },
  },
  {
    family: 'Meta Llama 4 vision',
    matches: /^meta\/llama-4-(?:scout|maverick)/,
    capabilities: { imageInput: true },
  },
  {
    family: 'xAI Grok',
    matches: /^(?:xai|spacexai)\/grok-/,
    capabilities: {
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'xAI Grok vision',
    matches: /^(?:xai|spacexai)\/grok-.*(?:vision|4)/,
    capabilities: { imageInput: true },
  },
  {
    family: 'Zhipu GLM 4+',
    matches: /^(?:zhipu|zhipuai)\/glm-(?:4|5)/,
    capabilities: {
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'Alibaba Qwen 2.5/3',
    matches: /^(?:alibaba|qwen)\/qwen(?:2\.5|3)/,
    capabilities: {
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
  {
    family: 'ByteDance Seed 1.6+',
    matches: /^bytedance\/seed-(?:1\.6|2)/,
    capabilities: {
      tools: true,
      structuredOutput: true,
      webSearch: true,
    },
  },
];

/**
 * Capability overlay for chat models. The gateway model list carries no
 * vision/audio flags, so this small pattern list is the only manually
 * maintained capability data. Everything else (availability, pricing,
 * retirements) comes from the gateway sync.
 */
export function capabilitiesForModelId(modelId: string): ModelCapabilities {
  const id = resolveModelId(modelId).toLowerCase();
  const caps: Required<ModelCapabilities> = { ...FAIL_CLOSED_CAPABILITIES };
  for (const rule of MODEL_CAPABILITY_RULES) {
    if (rule.matches.test(id)) Object.assign(caps, rule.capabilities);
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
  const capabilities = capabilitiesForModelId(entry.id);
  return {
    id: entry.id,
    displayName: displayNameFor(entry.id, entry.name),
    supportsWebSearch: capabilities.webSearch === true,
    capabilities,
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
  const capabilities = capabilitiesForModelId(id);
  return {
    id,
    displayName,
    supportsWebSearch: capabilities.webSearch === true,
    capabilities,
  };
}

/**
 * Curated fallback catalog used until the first successful gateway sync
 * (no API key configured, gateway unreachable, first boot). All IDs are
 * gateway-valid `creator/model` slugs.
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
