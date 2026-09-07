import { describe, expect, it } from 'vitest';
import { generateRequestSchema } from '../src/modules/study-materials/study-materials.controller';
import {
  normalizePracticeProblemsContent,
  generateTitle,
} from '../src/modules/study-materials/content-normalizer';
import {
  validatePracticeProblems,
  validatePracticeProblemSources,
  prepareGeneratedPracticeProblems,
  ProblemEvaluationSchema,
} from '../src/modules/study-materials/practice-problems-content';
import { validateContent } from '../src/modules/study-materials/shapes';

const validSet = {
  title: 'newton-laws-practice-problems',
  overview: 'Practice set',
  sourceIds: ['src-1'],
  problems: [
    {
      id: 'p-1',
      prompt: 'Calculate the force.',
      givens: ['m = 2kg'],
      constraints: ['Use SI units'],
      hints: ['Think F=ma', 'Multiply'],
      steps: [
        {
          id: 'p-1-s-1',
          title: 'Identify mass',
          explanation: 'Mass is 2kg because given.',
          sourceIds: [],
        },
        {
          id: 'p-1-s-2',
          title: 'Multiply',
          explanation: 'Multiply by acceleration.',
          sourceIds: ['src-1'],
        },
      ],
      answer: 'F = 20N',
      checklist: ['Correct units'],
      acceptableAlternatives: ['20 N'],
      sourceIds: ['src-1'],
    },
  ],
};

describe('practice problems content validation', () => {
  it('accepts a valid set with hints, steps, checklist', () => {
    expect(() => validatePracticeProblems(validSet)).not.toThrow();
  });

  it('rejects duplicate problem IDs', () => {
    expect(() =>
      validatePracticeProblems({
        ...validSet,
        problems: [validSet.problems[0], validSet.problems[0]],
      }),
    ).toThrow();
  });

  it('rejects duplicate step IDs within a problem', () => {
    expect(() =>
      validatePracticeProblems({
        ...validSet,
        problems: [
          {
            ...validSet.problems[0],
            steps: [
              validSet.problems[0].steps[0],
              validSet.problems[0].steps[0],
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it('works through the generic kind validator and stays usable without hints or references', () => {
    const minimal = {
      title: 't-practice-problems',
      problems: [
        {
          id: 'p-1',
          prompt: 'Explain.',
          steps: [{ id: 's-1', title: 'Answer', explanation: 'Because.' }],
          answer: 'Done',
        },
      ],
    };
    const validated = validateContent(
      'practice_problems',
      minimal,
    ) as typeof validSet;
    expect(validated.problems[0].hints).toEqual([]);
    expect(validated.problems[0].sourceIds).toEqual([]);
  });
});

describe('practice problems sources', () => {
  it('rejects references outside the selected sources', () => {
    expect(() => validatePracticeProblemSources(validSet, [])).toThrow();
    expect(() =>
      validatePracticeProblemSources(validSet, ['src-1']),
    ).not.toThrow();
  });

  it('rejects step-level references outside the selected sources', () => {
    const bad = {
      ...validSet,
      problems: [
        {
          ...validSet.problems[0],
          sourceIds: [],
          steps: [
            { id: 's', title: 'T', explanation: 'E', sourceIds: ['other'] },
          ],
        },
      ],
    };
    expect(() => validatePracticeProblemSources(bad, ['src-1'])).toThrow();
  });
});

describe('practice problems generation options', () => {
  it('accepts problemCount 1-30 and rejects out-of-range counts', () => {
    const base = {
      kind: 'practice_problems' as const,
      brief: 'physics',
      sourceIds: [] as string[],
    };
    expect(
      generateRequestSchema.safeParse({
        ...base,
        practiceProblemsOptions: { problemCount: 8, difficulty: 'medium' },
      }).success,
    ).toBe(true);
    expect(
      generateRequestSchema.safeParse({
        ...base,
        practiceProblemsOptions: { problemCount: 0, difficulty: 'medium' },
      }).success,
    ).toBe(false);
    expect(
      generateRequestSchema.safeParse({
        ...base,
        practiceProblemsOptions: { problemCount: 31, difficulty: 'medium' },
      }).success,
    ).toBe(false);
  });

  it('enforces problem count match on prepare', () => {
    expect(() =>
      prepareGeneratedPracticeProblems(validSet, ['src-1'], {
        problemCount: 1,
      }),
    ).not.toThrow();
    expect(() =>
      prepareGeneratedPracticeProblems(validSet, ['src-1'], {
        problemCount: 2,
      }),
    ).toThrow();
  });

  it('supports questionCount alias for problem count', () => {
    expect(() =>
      prepareGeneratedPracticeProblems(validSet, ['src-1'], {
        questionCount: 1,
      }),
    ).not.toThrow();
  });

  it('preserves difficulty option or defaults to medium', () => {
    const prepared = prepareGeneratedPracticeProblems(validSet, ['src-1'], {
      problemCount: 1,
      difficulty: 'hard',
    });
    expect(prepared.difficulty).toBe('hard');

    const defaultPrepared = prepareGeneratedPracticeProblems(
      validSet,
      ['src-1'],
      {
        problemCount: 1,
      },
    );
    expect(defaultPrepared.difficulty).toBe('medium');
  });
});

describe('problem evaluation schema', () => {
  it('validates correct, partially_correct, and needs_improvement outputs', () => {
    expect(
      ProblemEvaluationSchema.safeParse({
        status: 'correct',
        feedback: 'Great job!',
        strengths: ['Accurate calculation'],
        missingPoints: [],
      }).success,
    ).toBe(true);

    expect(
      ProblemEvaluationSchema.safeParse({
        status: 'invalid_status',
        feedback: 'No',
        strengths: [],
        missingPoints: [],
      }).success,
    ).toBe(false);
  });
});

describe('practice problems normalizer', () => {
  it('repairs partial output with stable IDs and preserves hint/step order', () => {
    const normalized = normalizePracticeProblemsContent({
      title: 'x',
      problems: [
        {
          prompt: 'P1',
          hints: ['first cue', 'second cue'],
          steps: [{ title: 'Do', explanation: 'Why' }],
          answer: 'A',
        },
      ],
    }) as typeof validSet;
    expect(normalized.problems[0].hints).toEqual(['first cue', 'second cue']);
    expect(normalized.problems[0].steps).toHaveLength(1);
    expect(normalized.problems[0].id).toBeTruthy();
  });

  it('generates a practice-problems title suffix and supports save/reopen content shape', () => {
    expect(generateTitle('practice_problems', { title: 'Newton Laws' })).toBe(
      'newton-laws-practice-problems',
    );
    const reopened = validateContent('practice_problems', validSet);
    expect(reopened).toMatchObject({ title: validSet.title });
  });
});
