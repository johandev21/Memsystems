import { describe, expect, it } from 'vitest';
import { generateRequestSchema } from '../src/modules/study-materials/study-materials.controller';

describe('generate request schema (slides)', () => {
  const base = {
    kind: 'slides' as const,
    brief: 'Photosynthesis basics',
    sourceIds: [] as string[],
  };

  it('accepts every design direction the slides form can send', () => {
    for (const theme of [
      'dark',
      'light',
      'accent',
      'editorial',
      'academic',
      'technical',
      'warm',
    ] as const) {
      const parsed = generateRequestSchema.safeParse({
        ...base,
        slidesOptions: { slideCount: 8, theme, detailLevel: 'detailed' },
      });
      expect(parsed.success, `theme "${theme}" should be accepted`).toBe(true);
    }
  });

  it('rejects unknown themes instead of failing mid-generation', () => {
    const parsed = generateRequestSchema.safeParse({
      ...base,
      slidesOptions: { slideCount: 8, theme: 'hologram', detailLevel: 'basic' },
    });
    expect(parsed.success).toBe(false);
  });
});
