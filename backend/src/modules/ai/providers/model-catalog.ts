import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway';
import type { ModelCapabilities, ProviderModel } from './provider';

export const GATEWAY_DEFAULT_MODEL = 'openai/gpt-5.6-sol';

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

export function creatorFromModel(modelId: string): string | null {
  const resolved = resolveModelId(modelId);
  const slash = resolved.indexOf('/');
  if (slash <= 0) return null;
  return resolved.slice(0, slash);
}

export interface GatewayPublicModel {
  id: string;
  name?: string | null;
  type?: string | null;
  tags?: string[] | null;
  supported_parameters?: string[] | null;
}

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

export function buildCapabilityOverlay(
  entries: readonly GatewayPublicModel[],
): Map<string, ModelCapabilities> {
  const overlay = new Map<string, ModelCapabilities>();
  for (const entry of entries) {
    overlay.set(resolveModelId(entry.id), capabilitiesFromPublicModel(entry));
  }
  return overlay;
}

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
  return { id, displayName };
}

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
