import type { ProviderModel } from './provider';

export const PROVIDER_IDS = [
  'openai',
  'deepseek',
  'anthropic',
  'google',
  'kimi',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  kimi: 'Kimi',
};

export const PROVIDER_MODELS: Record<ProviderId, ProviderModel[]> = {
  openai: [
    {
      id: 'openai/gpt-5.6-sol',
      displayName: 'GPT-5.6 Sol',
      supportsWebSearch: true,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: true,
      },
    },
    {
      id: 'openai/gpt-5.6-terra',
      displayName: 'GPT-5.6 Terra',
      supportsWebSearch: true,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: true,
      },
    },
    {
      id: 'openai/gpt-5.6-luna',
      displayName: 'GPT-5.6 Luna',
      supportsWebSearch: true,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: true,
      },
    },
    {
      id: 'openai/gpt-5.5',
      displayName: 'GPT-5.5',
      supportsWebSearch: true,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: true,
      },
    },
    {
      id: 'openai/gpt-5.5-pro',
      displayName: 'GPT-5.5 Pro',
      supportsWebSearch: true,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: true,
      },
    },
  ],
  deepseek: [
    {
      id: 'deepseek/deepseek-v4-flash',
      displayName: 'DeepSeek V4 Flash',
      supportsWebSearch: false,
      capabilities: {
        imageInput: false,
        fileInput: false,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
    {
      id: 'deepseek/deepseek-v3',
      displayName: 'DeepSeek V3',
      supportsWebSearch: false,
      capabilities: {
        imageInput: false,
        fileInput: false,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
    {
      id: 'deepseek/deepseek-r1',
      displayName: 'DeepSeek R1',
      supportsWebSearch: false,
      capabilities: {
        imageInput: false,
        fileInput: false,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
  ],
  anthropic: [
    {
      id: 'anthropic/claude-sonnet-5',
      displayName: 'Claude Sonnet 5',
      supportsWebSearch: false,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
    {
      id: 'anthropic/claude-opus-4.8',
      displayName: 'Claude Opus 4.8',
      supportsWebSearch: false,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
  ],
  google: [
    {
      id: 'google/gemini-3.6-pro',
      displayName: 'Gemini 3.6 Pro',
      supportsWebSearch: false,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
    {
      id: 'google/gemini-3.6-flash',
      displayName: 'Gemini 3.6 Flash',
      supportsWebSearch: false,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
    {
      id: 'google/gemini-3.6-thinking',
      displayName: 'Gemini 3.6 Thinking',
      supportsWebSearch: false,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: true,
        webSearch: false,
      },
    },
  ],
  kimi: [
    {
      id: 'kimi/kimi-k3',
      displayName: 'Kimi K3',
      supportsWebSearch: false,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: false,
        webSearch: false,
      },
    },
    {
      id: 'kimi/kimi-k2.6',
      displayName: 'Kimi K2.6',
      supportsWebSearch: false,
      capabilities: {
        imageInput: true,
        fileInput: true,
        audioInput: false,
        tools: true,
        structuredOutput: true,
        reasoning: false,
        webSearch: false,
      },
    },
  ],
};

export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: 'openai/gpt-5.6-sol',
  deepseek: 'deepseek/deepseek-v4-flash',
  anthropic: 'anthropic/claude-sonnet-5',
  google: 'google/gemini-3.6-flash',
  kimi: 'kimi/kimi-k3',
};

export function providerIdFromModel(modelId: string): ProviderId | null {
  const providerId = modelId.split('/')[0] as ProviderId;
  return PROVIDER_IDS.includes(providerId) ? providerId : null;
}

export function nativeModelId(modelId: string): string {
  const nativeId = modelId.includes('/')
    ? modelId.slice(modelId.indexOf('/') + 1)
    : modelId;
  return nativeId === 'claude-opus-4.8' ? 'claude-opus-4-8' : nativeId;
}
