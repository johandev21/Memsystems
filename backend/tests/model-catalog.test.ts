import { describe, expect, it } from 'vitest';
import {
  PROVIDER_IDS,
  PROVIDER_MODELS,
  nativeModelId,
  providerIdFromModel,
} from '../src/modules/ai/providers/model-catalog';

describe('provider model catalog', () => {
  it('contains the supported providers and requested current models', () => {
    expect(PROVIDER_IDS).toEqual([
      'openai',
      'deepseek',
      'anthropic',
      'google',
      'kimi',
    ]);
    expect(PROVIDER_MODELS.openai.map((model) => model.id)).toContain(
      'openai/gpt-5.6-sol',
    );
    expect(PROVIDER_MODELS.deepseek.map((model) => model.id)).toContain(
      'deepseek/deepseek-r1',
    );
    expect(PROVIDER_MODELS.anthropic.map((model) => model.id)).toContain(
      'anthropic/claude-sonnet-5',
    );
    expect(PROVIDER_MODELS.google.map((model) => model.id)).toContain(
      'google/gemini-3.6-thinking',
    );
    expect(PROVIDER_MODELS.kimi.map((model) => model.id)).toContain(
      'kimi/kimi-k3',
    );
  });

  it('resolves provider and native model IDs', () => {
    expect(providerIdFromModel('anthropic/claude-sonnet-5')).toBe('anthropic');
    expect(providerIdFromModel('unknown/model')).toBeNull();
    expect(nativeModelId('kimi/kimi-k2.6')).toBe('kimi-k2.6');
  });

  it('exposes model capability flags', () => {
    const gptSol = PROVIDER_MODELS.openai.find(
      (m) => m.id === 'openai/gpt-5.6-sol',
    );
    expect(gptSol?.capabilities?.imageInput).toBe(true);
    expect(gptSol?.capabilities?.tools).toBe(true);

    const deepseek = PROVIDER_MODELS.deepseek.find(
      (m) => m.id === 'deepseek/deepseek-v4-flash',
    );
    expect(deepseek?.capabilities?.imageInput).toBe(false);
  });
});
