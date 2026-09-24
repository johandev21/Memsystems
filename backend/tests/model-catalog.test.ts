import { describe, expect, it } from 'vitest';
import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway';
import {
  GATEWAY_DEFAULT_MODEL,
  MODEL_ID_ALIASES,
  SEED_GATEWAY_MODELS,
  buildCapabilityOverlay,
  buildChatCatalog,
  capabilitiesFromPublicModel,
  creatorFromModel,
  resolveModelId,
  toProviderModel,
} from '../src/modules/ai/providers/model-catalog';

function entry(
  id: string,
  modelType?: GatewayLanguageModelEntry['modelType'],
  pricing?: { input: string; output: string },
): GatewayLanguageModelEntry {
  return {
    id,
    name: `Name for ${id}`,
    modelType,
    pricing: pricing ?? null,
    specification: {
      specificationVersion: 'v4',
      provider: 'gateway',
      modelId: id,
    },
  };
}

const NO_CAPABILITIES = {
  imageInput: false,
  fileInput: false,
  audioInput: false,
  tools: false,
  structuredOutput: false,
  reasoning: false,
  webSearch: false,
};

describe('gateway model catalog', () => {
  it('resolves stale model IDs to gateway slugs', () => {
    expect(resolveModelId('kimi/kimi-k3')).toBe('moonshotai/kimi-k3');
    expect(resolveModelId('kimi/kimi-k2.6')).toBe('moonshotai/kimi-k2.6');
    expect(resolveModelId('deepseek/deepseek-v3')).toBe(
      'deepseek/deepseek-v3.2',
    );
    expect(resolveModelId('google/gemini-3.6-pro')).toBe(
      'google/gemini-2.5-pro',
    );
    expect(resolveModelId('openai/gpt-5.6-sol')).toBe('openai/gpt-5.6-sol');
    expect(Object.keys(MODEL_ID_ALIASES)).toHaveLength(5);
  });

  it('exposes the gateway creator prefix for spend attribution', () => {
    expect(creatorFromModel('openai/gpt-5.6-sol')).toBe('openai');
    expect(creatorFromModel('not-a-model-id')).toBeNull();
  });

  it('maps gateway public tags to model capabilities', () => {
    expect(
      capabilitiesFromPublicModel({
        id: 'openai/gpt-5.6-sol',
        tags: [
          'vision',
          'file-input',
          'audio-input',
          'tool-use',
          'structured-output',
          'reasoning',
          'web-search',
        ],
      }),
    ).toEqual({
      imageInput: true,
      fileInput: true,
      audioInput: true,
      tools: true,
      structuredOutput: true,
      reasoning: true,
      webSearch: true,
    });
    // Absent or empty tags claim nothing (fail closed).
    expect(
      capabilitiesFromPublicModel({ id: 'mystery/no-tags' }),
    ).toEqual(NO_CAPABILITIES);
    expect(
      capabilitiesFromPublicModel({ id: 'mystery/plain', tags: [] }),
    ).toEqual(NO_CAPABILITIES);
    expect(
      capabilitiesFromPublicModel({
        id: 'mystery/vision-only',
        tags: ['vision'],
      }),
    ).toEqual({ ...NO_CAPABILITIES, imageInput: true });
  });

  it('corroborates tools and structured output with supported_parameters', () => {
    expect(
      capabilitiesFromPublicModel({
        id: 'mystery/params',
        supported_parameters: ['tools', 'response_format'],
      }),
    ).toMatchObject({ tools: true, structuredOutput: true });
    expect(
      capabilitiesFromPublicModel({
        id: 'mystery/params',
        supported_parameters: ['structured_outputs'],
      }),
    ).toMatchObject({ structuredOutput: true });
    // A parameter-only claim never leaks into the other capabilities.
    expect(
      capabilitiesFromPublicModel({
        id: 'mystery/params',
        supported_parameters: ['tools'],
      }),
    ).toEqual({ ...NO_CAPABILITIES, tools: true });
  });

  it('keeps only chat models from gateway metadata', () => {
    const models = buildChatCatalog([
      entry('openai/gpt-5.6-sol', 'language'),
      entry('openai/text-embedding-3-small', 'embedding'),
      entry('openai/gpt-image-1', 'image'),
      entry('openai/whisper-1', 'transcription'),
      entry('openai/tts-1', 'speech'),
      entry('google/veo-3.1-generate-001', 'video'),
      entry('perplexity/sonar', 'language'),
      // Missing discriminator falls back to slug filtering.
      entry('openai/gpt-4o-mini-transcribe'),
      entry('mystery/chat-model-x'),
    ]);
    const ids = models.map((m) => m.id);
    expect(ids).toContain('openai/gpt-5.6-sol');
    expect(ids).toContain('perplexity/sonar');
    expect(ids).toContain('mystery/chat-model-x');
    expect(ids).not.toContain('openai/text-embedding-3-small');
    expect(ids).not.toContain('openai/gpt-image-1');
    expect(ids).not.toContain('openai/whisper-1');
    expect(ids).not.toContain('openai/tts-1');
    expect(ids).not.toContain('google/veo-3.1-generate-001');
    expect(ids).not.toContain('openai/gpt-4o-mini-transcribe');
    // Sorted for a stable picker.
    expect(ids).toEqual([...ids].sort());
  });

  it('applies the gateway public overlay keyed by resolved model id', () => {
    const overlay = buildCapabilityOverlay([
      {
        id: 'kimi/kimi-k3',
        tags: ['structured-output', 'tool-use', 'web-search', 'vision'],
      },
      { id: 'openai/gpt-5.6-sol', tags: ['structured-output', 'reasoning'] },
    ]);
    const models = buildChatCatalog(
      [
        entry('moonshotai/kimi-k3', 'language'),
        entry('openai/gpt-5.6-sol', 'language'),
        entry('acme/unlisted-model', 'language'),
      ],
      overlay,
    );
    const byId = new Map(models.map((m) => [m.id, m]));
    expect(byId.get('moonshotai/kimi-k3')?.capabilities).toMatchObject({
      structuredOutput: true,
      tools: true,
      webSearch: true,
      imageInput: true,
    });
    expect(byId.get('moonshotai/kimi-k3')?.supportsWebSearch).toBe(true);
    expect(byId.get('openai/gpt-5.6-sol')?.capabilities).toMatchObject({
      structuredOutput: true,
      reasoning: true,
      webSearch: false,
    });
    expect(byId.get('openai/gpt-5.6-sol')?.supportsWebSearch).toBe(false);
    // Models absent from the public list get no claims at all.
    expect(byId.get('acme/unlisted-model')?.capabilities).toBeUndefined();
    expect(byId.get('acme/unlisted-model')?.supportsWebSearch).toBeUndefined();
  });

  it('omits capabilities entirely when no overlay is available', () => {
    const models = buildChatCatalog([
      entry('mystery/chat-model-x', 'language'),
      entry('openai/gpt-4o-mini', 'language'),
    ]);
    for (const model of models) {
      expect(model.capabilities).toBeUndefined();
      expect(model.supportsWebSearch).toBeUndefined();
      expect(model.displayName).toBeTruthy();
    }
  });

  it('accepts an explicit capability overlay in toProviderModel', () => {
    expect(
      toProviderModel(entry('mystery/chat-model-x', 'language'), {
        structuredOutput: true,
        webSearch: false,
      }),
    ).toMatchObject({
      supportsWebSearch: false,
      capabilities: { structuredOutput: true },
    });
    expect(toProviderModel(entry('openai/gpt-image-1', 'image'))).toBeNull();
  });

  it('flags free-tier models from slugs and zero pricing', () => {
    const models = buildChatCatalog([
      entry('poolside/laguna-s-2.1-free', 'language'),
      entry('openai/gpt-4o-mini', 'language', { input: '0', output: '0' }),
      entry('openai/gpt-5.6-sol', 'language', {
        input: '0.000001',
        output: '0.000004',
      }),
    ]);
    const byId = new Map(models.map((m) => [m.id, m]));
    expect(byId.get('poolside/laguna-s-2.1-free')?.isFreeTier).toBe(true);
    expect(byId.get('openai/gpt-4o-mini')?.isFreeTier).toBe(true);
    expect(byId.get('openai/gpt-5.6-sol')?.isFreeTier).toBe(false);
    expect(byId.get('openai/gpt-5.6-sol')?.pricing).toEqual({
      input: 0.000001,
      output: 0.000004,
    });
  });

  it('ships a seed catalog with ids and names but no capability claims', () => {
    expect(SEED_GATEWAY_MODELS.length).toBeGreaterThan(0);
    for (const model of SEED_GATEWAY_MODELS) {
      expect(model.id).toMatch(/^[^/]+\/[^/]+$/);
      expect(resolveModelId(model.id)).toBe(model.id);
      expect(model.displayName).toBeTruthy();
      expect(model.capabilities).toBeUndefined();
      expect(model.supportsWebSearch).toBeUndefined();
    }
    expect(
      SEED_GATEWAY_MODELS.some((m) => m.id === GATEWAY_DEFAULT_MODEL),
    ).toBe(true);
  });
});
