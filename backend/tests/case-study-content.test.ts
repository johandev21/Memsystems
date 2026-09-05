import { describe, expect, it } from 'vitest';
import { generateRequestSchema } from '../src/modules/study-materials/study-materials.controller';
import {
  normalizeCaseStudyContent,
  generateTitle,
} from '../src/modules/study-materials/content-normalizer';
import {
  validateCaseStudy,
  validateCaseStudySources,
  prepareGeneratedCaseStudy,
} from '../src/modules/study-materials/case-study-content';
import { validateContent } from '../src/modules/study-materials/shapes';

const validCase = {
  title: 'clinic-triage-case-study',
  learningObjectives: ['Apply triage concepts to a fictional clinic'],
  scenario: {
    title: 'Morning rush',
    setting: 'Fictional Riverside Clinic',
    narrative: 'A fictional morning rush brings three patients at once.',
    isFictional: true,
  },
  facts: ['Two nurses are on shift'],
  questions: [
    { id: 'q-1', prompt: 'Who should be seen first?', hint: '' },
    { id: 'q-2', prompt: 'What tradeoff do you accept?', hint: '' },
  ],
  analyses: [
    {
      questionId: 'q-1',
      reasoning: 'Severity first because breathing issues escalate.',
      keyPoints: ['Airway first'],
      conceptApplications: [
        { concept: 'Triage', application: 'Applied to breathing case', sourceIds: ['src-1'] },
      ],
      assumptions: ['Vitals are accurate'],
      tradeoffs: ['Longer wait for stable patients'],
      alternativePerspectives: [
        { viewpoint: 'Throughput view', reasoning: 'See quick cases first', sourceIds: [] },
      ],
      checklist: ['Named the concept', 'Cited evidence', 'Explained reasoning'],
      sourceIds: ['src-1'],
    },
    {
      questionId: 'q-2',
      reasoning: 'Accept a longer wait for stable cases.',
      keyPoints: [],
      conceptApplications: [],
      assumptions: [],
      tradeoffs: [],
      alternativePerspectives: [],
      checklist: ['Explained tradeoff'],
      sourceIds: [],
    },
  ],
  conceptsFocus: 'triage',
  sourceIds: ['src-1'],
};

describe('case study content validation', () => {
  it('accepts a valid fictional case with per-question analysis', () => {
    expect(() => validateCaseStudy(validCase)).not.toThrow();
  });

  it('rejects duplicate question IDs', () => {
    expect(() =>
      validateCaseStudy({
        ...validCase,
        questions: [validCase.questions[0], validCase.questions[0]],
      }),
    ).toThrow();
  });

  it('rejects analyses pointing at unknown questions', () => {
    expect(() =>
      validateCaseStudy({
        ...validCase,
        analyses: [{ ...validCase.analyses[0], questionId: 'missing' }],
      }),
    ).toThrow();
  });

  it('keeps legacy cases without new analysis fields readable', () => {
    const legacy = {
      title: 'old-case-study',
      learningObjectives: ['Learn'],
      scenario: { setting: 'Fictional shop', narrative: 'A story.' },
      questions: [{ id: 'q-1', prompt: 'Decide.' }],
    };
    const validated = validateContent('case_study', legacy) as typeof validCase;
    expect(validated.questions).toHaveLength(1);
    expect(validated.analyses).toEqual([]);
    expect(validated.scenario.isFictional).toBe(true);
  });
});

describe('case study sources', () => {
  it('rejects references outside the selected sources', () => {
    expect(() => validateCaseStudySources(validCase, [])).toThrow();
    expect(() =>
      validateCaseStudySources(validCase, ['src-1']),
    ).not.toThrow();
  });

  it('rejects nested concept references outside the selected sources', () => {
    const bad = {
      ...validCase,
      analyses: [
        {
          ...validCase.analyses[0],
          conceptApplications: [
            { concept: 'C', application: 'A', sourceIds: ['other'] },
          ],
        },
        validCase.analyses[1],
      ],
    };
    expect(() => validateCaseStudySources(bad, ['src-1'])).toThrow();
  });
});

describe('case study generation options', () => {
  it('accepts questionCount 1-10 and focus/compare options', () => {
    const base = { kind: 'case_study' as const, brief: 'clinic', sourceIds: [] as string[] };
    expect(
      generateRequestSchema.safeParse({
        ...base,
        caseStudyOptions: { questionCount: 4, focus: 'triage', comparePerspectives: true },
      }).success,
    ).toBe(true);
    expect(
      generateRequestSchema.safeParse({
        ...base,
        caseStudyOptions: { questionCount: 0, focus: '', comparePerspectives: false },
      }).success,
    ).toBe(false);
    expect(
      generateRequestSchema.safeParse({
        ...base,
        caseStudyOptions: { questionCount: 11, focus: '', comparePerspectives: false },
      }).success,
    ).toBe(false);
  });

  it('enforces question/analysis match and fictional scenarios', () => {
    expect(() =>
      prepareGeneratedCaseStudy(validCase, ['src-1'], { questionCount: 2 }),
    ).not.toThrow();
    expect(() =>
      prepareGeneratedCaseStudy(validCase, ['src-1'], { questionCount: 3 }),
    ).toThrow();
    expect(() =>
      prepareGeneratedCaseStudy(
        { ...validCase, scenario: { ...validCase.scenario, isFictional: false } },
        ['src-1'],
        { questionCount: 2 },
      ),
    ).toThrow();
  });
});

describe('case study normalizer', () => {
  it('repairs partial output with stable IDs and fictional default', () => {
    const normalized = normalizeCaseStudyContent({
      title: 'x',
      scenario: { setting: 'Shop', narrative: 'Story' },
      questions: [{ prompt: 'Decide?' }],
      analyses: [{ reasoning: 'Because.' }],
    }) as typeof validCase;
    expect(normalized.questions[0].id).toBeTruthy();
    expect(normalized.analyses[0].questionId).toBe(normalized.questions[0].id);
    expect(normalized.scenario.isFictional).toBe(true);
  });

  it('generates a case-study title suffix and supports reopen', () => {
    expect(generateTitle('case_study', { title: 'Clinic Triage' })).toBe(
      'clinic-triage-case-study',
    );
    const reopened = validateContent('case_study', validCase);
    expect(reopened).toMatchObject({ title: validCase.title });
  });
});
