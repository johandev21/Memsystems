import { describe, expect, it } from 'vitest';
import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway';
import {
  GATEWAY_DEFAULT_MODEL,
  MODEL_ID_ALIASES,
  SEED_GATEWAY_MODELS,
  buildChatCatalog,
  capabilitiesForModelId,
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

  it('marks every chat model as web-search capable with gateway tools', () => {
    const models = buildChatCatalog([
      entry('deepseek/deepseek-v3.2', 'language'),
      entry('spacexai/grok-4.6', 'language'),
    ]);
    for (const model of models) {
      expect(model.supportsWebSearch).toBe(true);
      expect(model.capabilities?.webSearch).toBe(true);
      expect(model.displayName).toBeTruthy();
    }
  });

  it('applies the capability overlay', () => {
    expect(capabilitiesForModelId('openai/gpt-5.6-sol')).toMatchObject({
      imageInput: true,
      reasoning: true,
    });
    expect(capabilitiesForModelId('anthropic/claude-sonnet-5')).toMatchObject({
      imageInput: true,
      reasoning: true,
    });
    expect(capabilitiesForModelId('google/gemini-3.6-flash')).toMatchObject({
      imageInput: true,
    });
    expect(capabilitiesForModelId('moonshotai/kimi-k3')).toMatchObject({
      imageInput: true,
    });
    expect(capabilitiesForModelId('deepseek/deepseek-v4-flash')).toMatchObject({
      imageInput: false,
      fileInput: false,
    });
    expect(
      capabilitiesForModelId('deepseek/deepseek-v3.2-thinking'),
    ).toMatchObject({
      reasoning: true,
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

  it('ships a valid gateway seed catalog', () => {    expect(SEED_GATEWAY_MODELS.length).toBeGreaterThan(0);
    for (const model of SEED_GATEWAY_MODELS) {
      expect(model.id).toMatch(/^[^/]+\/[^/]+$/);
      expect(resolveModelId(model.id)).toBe(model.id);
      expect(model.displayName).toBeTruthy();
      expect(model.supportsWebSearch).toBe(true);
    }
    expect(
      SEED_GATEWAY_MODELS.some((m) => m.id === GATEWAY_DEFAULT_MODEL),
    ).toBe(true);
  });
});
