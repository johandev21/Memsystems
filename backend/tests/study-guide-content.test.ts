import { describe, expect, it } from 'vitest';
import { generateRequestSchema } from '../src/modules/study-materials/study-materials.controller';
import { getPromptTemplate } from '../src/modules/study-materials/prompts';
import { validateContent } from '../src/modules/study-materials/shapes';
import {
  StudyGuideOptions,
  prepareGeneratedStudyGuide,
  validateStudyGuide,
  validateStudyGuideSources,
} from '../src/modules/study-materials/study-guide-content';
import { BadRequestError } from '../src/common/errors/domain-error';

function makeSection(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Section ${id}`,
    explanation: `Explanation for ${id}.`,
    keyConcepts: [`Concept of ${id}`],
    examples: [`Example of ${id}`],
    misconceptions: ['Plants obtain their energy from soil alone.'],
    takeaways: ['Light provides energy for photosynthesis.'],
    ...overrides,
  };
}

function makeGuide(overrides: Record<string, unknown> = {}) {
  return {
    title: 'photosynthesis-study-guide',
    overview: 'How plants convert light into chemical energy.',
    learningObjectives: ['Explain the light-dependent reactions.'],
    sections: [makeSection('s1'), makeSection('s2')],
    ...overrides,
  };
}

describe('study guide content validation', () => {
  it('accepts a well-formed guide through the shared validator', () => {
    expect(() => validateContent('study_guide', makeGuide())).not.toThrow();
  });

  it('rejects guides with duplicate section ids instead of saving them', () => {
    const guide = makeGuide({
      sections: [makeSection('dup'), makeSection('dup')],
    });
    expect(() => validateContent('study_guide', guide)).toThrow(
      BadRequestError,
    );
  });

  it('rejects guides without sections', () => {
    expect(() =>
      validateContent('study_guide', makeGuide({ sections: [] })),
    ).toThrow(BadRequestError);
  });

  it('rejects malformed generation output with a recoverable error', () => {
    expect(() => validateContent('study_guide', { title: 'nope' })).toThrow(
      BadRequestError,
    );
    expect(() => validateContent('study_guide', null)).toThrow(BadRequestError);
  });

  it('keeps older guides without a format or references readable', () => {
    const legacy = {
      title: 'legacy-study-guide',
      overview: 'Old overview.',
      learningObjectives: ['Old objective.'],
      sections: [
        {
          id: 's1',
          title: 'Old section',
          explanation: 'Old explanation.',
          keyConcepts: ['Old concept'],
          examples: [],
        },
      ],
    };
    const parsed = validateStudyGuide(legacy);
    expect(parsed.format).toBe('detailed');
    expect(parsed.sourceIds).toEqual([]);
    expect(parsed.sections[0].sourceIds).toEqual([]);
  });
});

describe('study guide source references', () => {
  it('accepts references to selected sources', () => {
    const guide = makeGuide({
      sourceIds: ['src-1'],
      sections: [makeSection('s1', { sourceIds: ['src-1'] })],
    });
    const parsed = validateStudyGuideSources(guide, ['src-1', 'src-2']);
    expect(parsed.sections[0].sourceIds).toEqual(['src-1']);
  });

  it('rejects references to unselected or unavailable sources', () => {
    const guide = makeGuide({
      sections: [makeSection('s1', { sourceIds: ['src-unknown'] })],
    });
    expect(() => validateStudyGuideSources(guide, ['src-1'])).toThrow(
      BadRequestError,
    );
  });

  it('keeps brief-only guides free of fabricated references', () => {
    const clean = makeGuide();
    expect(() => validateStudyGuideSources(clean, [])).not.toThrow();
    const fabricated = makeGuide({
      sections: [makeSection('s1', { sourceIds: ['src-invented'] })],
    });
    expect(() => validateStudyGuideSources(fabricated, [])).toThrow(
      BadRequestError,
    );
  });
});

describe('study guide formats and section limits', () => {
  it('requires teaching content for new detailed guides while preserving revision and legacy content', () => {
    const incomplete = makeGuide({
      sections: [
        makeSection('s1', { examples: [], misconceptions: [], takeaways: [] }),
      ],
    });
    expect(() =>
      prepareGeneratedStudyGuide(incomplete, [], {
        format: 'detailed',
        sectionCount: 1,
      }),
    ).toThrow(BadRequestError);
    expect(() =>
      prepareGeneratedStudyGuide(incomplete, [], {
        format: 'revision',
        sectionCount: 1,
      }),
    ).not.toThrow();
    expect(() => validateStudyGuide(incomplete)).not.toThrow();
  });
  it('persists the requested format on generated guides', () => {
    const base = makeGuide({ sections: [makeSection('s1')] });
    expect(
      prepareGeneratedStudyGuide(base, [], {
        format: 'detailed',
        sectionCount: 1,
      }).format,
    ).toBe('detailed');
    expect(
      prepareGeneratedStudyGuide(base, [], {
        format: 'revision',
        sectionCount: 1,
      }).format,
    ).toBe('revision');
  });

  it('keeps the model format and skips gates when auto is requested', () => {
    const revisionGuide = makeGuide({
      format: 'revision',
      sections: [
        makeSection('s1', {
          examples: [],
          misconceptions: [],
          takeaways: [],
        }),
      ],
    });
    const prepared = prepareGeneratedStudyGuide(revisionGuide, [], {
      format: 'auto',
      sectionCount: 0,
    });
    // Auto means the model chose, so neither the detailed-extras gate nor the
    // count check applies, and the model's own format is kept.
    expect(prepared.format).toBe('revision');
    expect(prepared.sections).toHaveLength(1);
  });

  it('rejects output whose section count does not match the request', () => {
    const twoSections = makeGuide();
    expect(() =>
      prepareGeneratedStudyGuide(twoSections, [], {
        format: 'detailed',
        sectionCount: 6,
      }),
    ).toThrow(BadRequestError);
  });

  it('enforces section-count limits on generation options', () => {
    expect(
      StudyGuideOptions.safeParse({ format: 'auto', sectionCount: 0 }).success,
    ).toBe(true);
    expect(
      StudyGuideOptions.safeParse({ format: 'revision', sectionCount: 13 })
        .success,
    ).toBe(false);
    expect(
      StudyGuideOptions.safeParse({ format: 'cheatsheet', sectionCount: 2 })
        .success,
    ).toBe(false);
  });

  it('enforces content-length limits on generated output', () => {
    const tooLong = makeGuide({
      sections: [makeSection('s1', { explanation: 'x'.repeat(12001) })],
    });
    expect(() => validateStudyGuide(tooLong)).toThrow(BadRequestError);
    const tooManySections = makeGuide({
      sections: Array.from({ length: 13 }, (_, i) => makeSection(`s${i}`)),
    });
    expect(() => validateStudyGuide(tooManySections)).toThrow(BadRequestError);
  });
});

describe('study guide generation prompt', () => {
  it('passes the chosen format and exact section count to the model', () => {
    const template = getPromptTemplate('study_guide');
    const detailed = template.user('Cell biology', 'Source text', {
      studyGuideOptions: { format: 'detailed', sectionCount: 4 },
    });
    expect(detailed).toContain('detailed');
    expect(detailed).toContain('EXACTLY 4 sections');

    const revision = template.user('Cell biology', 'Source text', {
      studyGuideOptions: { format: 'revision', sectionCount: 2 },
    });
    expect(revision).toContain('revision');
    expect(revision).toContain('EXACTLY 2 sections');
    expect(revision).not.toBe(detailed);
  });

  it('asks the model to choose the format and count on auto', () => {
    const auto = getPromptTemplate('study_guide').user(
      'Cell biology',
      'Source text',
      {
        studyGuideOptions: { format: 'auto', sectionCount: 0 },
      },
    );
    expect(auto).toContain('Choose the format');
    expect(auto).toContain('"detailed"');
    expect(auto).toContain('"revision"');
    expect(auto).toContain('top-level "format"');
    expect(auto).toContain('source material and instructions');
    expect(auto).toContain('Decide how many sections');
    expect(auto).not.toMatch(/EXACTLY\s+0/i);
    // Auto must not silently assume the detailed shape.
    expect(auto).not.toMatch(/create a detailed guide/i);
  });

  it('forbids invented quotations, page numbers, and source ids', () => {
    const instructions = getPromptTemplate('study_guide').instructions;
    expect(instructions).toMatch(/do not invent/i);
    expect(instructions).toMatch(/quotation/i);
    expect(instructions).toMatch(/page number/i);
  });
});

describe('study guide generate request schema', () => {
  const base = {
    kind: 'study_guide' as const,
    brief: 'Photosynthesis basics',
    sourceIds: [] as string[],
  };

  it('accepts detailed, revision, and auto options', () => {
    for (const format of ['detailed', 'revision', 'auto'] as const) {
      const parsed = generateRequestSchema.safeParse({
        ...base,
        studyGuideOptions: { format, sectionCount: 6 },
      });
      expect(parsed.success, `format "${format}" should be accepted`).toBe(
        true,
      );
      expect(parsed.success && parsed.data.studyGuideOptions?.format).toBe(
        format,
      );
    }
  });

  it('accepts auto section counts and rejects out-of-range ones', () => {
    const auto = generateRequestSchema.safeParse({
      ...base,
      studyGuideOptions: { format: 'auto', sectionCount: 0 },
    });
    expect(auto.success).toBe(true);
    expect(auto.success && auto.data.studyGuideOptions?.sectionCount).toBe(0);

    const tooMany = generateRequestSchema.safeParse({
      ...base,
      studyGuideOptions: { format: 'detailed', sectionCount: 13 },
    });
    expect(tooMany.success).toBe(false);
  });
});
