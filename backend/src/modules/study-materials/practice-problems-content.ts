import { z } from 'zod';
import { BadRequestError } from '../../common/errors/domain-error';

export const PracticeProblemsOptions = z.object({
  problemCount: z.number().int().min(1).max(30).default(8),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});
export type PracticeProblemsGenerationOptions = z.infer<
  typeof PracticeProblemsOptions
>;

export const PracticeProblemWorkedStep = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(12000),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const PracticeProblem = z.object({
  id: z.string().min(1).max(100),
  prompt: z.string().min(1).max(5000),
  givens: z.array(z.string().min(1).max(2000)).max(10).default([]),
  constraints: z.array(z.string().min(1).max(2000)).max(10).default([]),
  hints: z.array(z.string().min(1).max(2000)).max(5).default([]),
  steps: z.array(PracticeProblemWorkedStep).min(1).max(12),
  answer: z.string().min(1).max(12000),
  checklist: z.array(z.string().min(1).max(1000)).max(10).default([]),
  acceptableAlternatives: z
    .array(z.string().min(1).max(2000))
    .max(10)
    .default([]),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const PracticeProblemsContent = z.object({
  title: z.string().min(1).max(200),
  overview: z.string().max(5000).default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  problems: z.array(PracticeProblem).min(1).max(30),
});

export const ProblemEvaluationSchema = z.object({
  status: z.enum(['correct', 'partially_correct', 'needs_improvement']),
  feedback: z
    .string()
    .describe('Clear, constructive feedback explaining the evaluation'),
  strengths: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
});
export type ProblemEvaluationResult = z.infer<typeof ProblemEvaluationSchema>;

export const EvaluateProblemRequestSchema = z.object({
  problemId: z.string().min(1).max(100),
  studentAnswer: z.string().min(1, 'Please enter your attempt').max(10000),
  modelId: z.string().min(1, 'modelId is required').max(200),
});
export type EvaluateProblemRequest = z.infer<
  typeof EvaluateProblemRequestSchema
>;

export function validatePracticeProblems(content: unknown) {
  const result = PracticeProblemsContent.safeParse(content);
  if (!result.success)
    throw new BadRequestError('Invalid practice problems content', {
      messageKey: 'errors.studyMaterials.practiceProblems.invalidContent',
    });
  const set = result.data;
  if (new Set(set.problems.map((p) => p.id)).size !== set.problems.length) {
    throw new BadRequestError('Practice problem IDs must be unique', {
      messageKey: 'errors.studyMaterials.practiceProblems.problemIdsUnique',
    });
  }
  for (const problem of set.problems) {
    if (new Set(problem.steps.map((s) => s.id)).size !== problem.steps.length) {
      throw new BadRequestError(
        'Worked step IDs must be unique within a problem',
        {
          messageKey: 'errors.studyMaterials.practiceProblems.stepIdsUnique',
        },
      );
    }
  }
  return set;
}

export function validatePracticeProblemSources(
  content: unknown,
  allowedSourceIds: string[],
) {
  const set = validatePracticeProblems(content);
  const allowed = new Set(allowedSourceIds);
  const bad = set.problems.some(
    (problem) =>
      problem.sourceIds.some((id) => !allowed.has(id)) ||
      problem.steps.some((step) =>
        step.sourceIds.some((id) => !allowed.has(id)),
      ),
  );
  if (bad) {
    throw new BadRequestError(
      'Practice problems reference an unselected or unavailable source',
      {
        messageKey: 'errors.studyMaterials.practiceProblems.sourceUnavailable',
      },
    );
  }
  return { ...set, sourceIds: [...allowed] };
}

export function prepareGeneratedPracticeProblems(
  content: unknown,
  sourceIds: string[],
  options?: {
    problemCount?: number;
    questionCount?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
  },
) {
  const set = validatePracticeProblemSources(content, sourceIds);
  const settings = PracticeProblemsOptions.parse({
    problemCount:
      options?.problemCount ?? options?.questionCount ?? set.problems.length,
    difficulty: options?.difficulty ?? 'medium',
  });
  if (set.problems.length !== settings.problemCount) {
    throw new BadRequestError(
      'Practice problem count does not match the request',
      { messageKey: 'errors.studyMaterials.practiceProblems.countMismatch' },
    );
  }
  return { ...set, difficulty: settings.difficulty };
}
