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

  it('accepts auto theme and auto detail level with an auto slide count', () => {
    const parsed = generateRequestSchema.safeParse({
      ...base,
      slidesOptions: { slideCount: 0, theme: 'auto', detailLevel: 'auto' },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.slidesOptions).toEqual({
      slideCount: 0,
      theme: 'auto',
      detailLevel: 'auto',
    });
  });
});

describe('generate request schema (auto options)', () => {
  const base = {
    kind: 'mind_map' as const,
    brief: 'Photosynthesis basics',
    sourceIds: [] as string[],
  };

  it('accepts auto detail levels for roadmap, mind map, and slides', () => {
    expect(
      generateRequestSchema.safeParse({
        ...base,
        kind: 'roadmap',
        roadmapOptions: { phaseCount: 0, detailLevel: 'auto' },
      }).success,
    ).toBe(true);
    expect(
      generateRequestSchema.safeParse({
        ...base,
        mindMapOptions: {
          nodeCount: 0,
          structure: 'radial',
          colorGroups: 'auto',
          crossLinks: false,
          detailLevel: 'auto',
        },
      }).success,
    ).toBe(true);
    expect(
      generateRequestSchema.safeParse({
        ...base,
        kind: 'slides',
        slidesOptions: { slideCount: 0, theme: 'auto', detailLevel: 'auto' },
      }).success,
    ).toBe(true);
  });

  it('still accepts explicit boolean colorGroups', () => {
    const parsed = generateRequestSchema.safeParse({
      ...base,
      mindMapOptions: {
        nodeCount: 12,
        structure: 'hierarchical',
        colorGroups: true,
        crossLinks: true,
        detailLevel: 'detailed',
      },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.mindMapOptions?.colorGroups).toBe(
      true,
    );
  });

  it('accepts auto difficulty and card style for quiz and flashcards', () => {
    expect(
      generateRequestSchema.safeParse({
        ...base,
        kind: 'quiz',
        questionCount: 0,
        difficulty: 'auto',
      }).success,
    ).toBe(true);
    expect(
      generateRequestSchema.safeParse({
        ...base,
        kind: 'simple_flashcard',
        questionCount: 0,
        difficulty: 'auto',
        cardStyle: 'auto',
      }).success,
    ).toBe(true);
  });
});
