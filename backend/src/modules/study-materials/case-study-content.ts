import { z } from 'zod';
import { BadRequestError } from '../../common/errors/domain-error';

export const CaseStudyOptions = z.object({
  questionCount: z.number().int().min(1).max(10).default(4),
  focus: z.string().max(2000).default(''),
  comparePerspectives: z.boolean().default(false),
});
export type CaseStudyGenerationOptions = z.infer<typeof CaseStudyOptions>;

export const CaseStudyConceptApplication = z.object({
  concept: z.string().min(1).max(500),
  application: z.string().min(1).max(4000),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const CaseStudyAlternativePerspective = z.object({
  viewpoint: z.string().min(1).max(500),
  reasoning: z.string().min(1).max(4000),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const CaseStudyQuestion = z.object({
  id: z.string().min(1).max(100),
  prompt: z.string().min(1).max(5000),
  hint: z.string().max(2000).default(''),
});

export const CaseStudyAnalysis = z.object({
  questionId: z.string().min(1).max(100),
  reasoning: z.string().min(1).max(12000),
  keyPoints: z.array(z.string().min(1).max(2000)).max(10).default([]),
  conceptApplications: z.array(CaseStudyConceptApplication).max(10).default([]),
  assumptions: z.array(z.string().min(1).max(2000)).max(10).default([]),
  tradeoffs: z.array(z.string().min(1).max(2000)).max(10).default([]),
  alternativePerspectives: z
    .array(CaseStudyAlternativePerspective)
    .max(10)
    .default([]),
  checklist: z.array(z.string().min(1).max(1000)).max(10).default([]),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const CaseStudyScenario = z.object({
  title: z.string().min(1).max(200).default('Scenario'),
  setting: z.string().min(1).max(5000),
  narrative: z.string().min(1).max(15000),
  isFictional: z.boolean().default(true),
});

export const CaseStudyContent = z.object({
  title: z.string().min(1).max(200),
  learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
  scenario: CaseStudyScenario,
  facts: z.array(z.string().min(1).max(2000)).max(20).default([]),
  questions: z.array(CaseStudyQuestion).min(1).max(10),
  analyses: z.array(CaseStudyAnalysis).max(10).default([]),
  conceptsFocus: z.string().max(2000).default(''),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export function validateCaseStudy(content: unknown) {
  const result = CaseStudyContent.safeParse(content);
  if (!result.success) throw new BadRequestError('Invalid case study content');
  const study = result.data;
  if (
    new Set(study.questions.map((q) => q.id)).size !== study.questions.length
  ) {
    throw new BadRequestError('Case study question IDs must be unique');
  }
  const questionIds = new Set(study.questions.map((q) => q.id));
  if (
    new Set(study.analyses.map((a) => a.questionId)).size !==
    study.analyses.length
  ) {
    throw new BadRequestError(
      'Case study analysis question IDs must be unique',
    );
  }
  for (const analysis of study.analyses) {
    if (!questionIds.has(analysis.questionId)) {
      throw new BadRequestError(
        'Case study analysis references an unknown question',
      );
    }
  }
  return study;
}

function collectCaseStudySourceIds(
  study: z.infer<typeof CaseStudyContent>,
): string[] {
  const ids: string[] = [...study.sourceIds];
  for (const analysis of study.analyses) {
    ids.push(...analysis.sourceIds);
    for (const app of analysis.conceptApplications) ids.push(...app.sourceIds);
    for (const alt of analysis.alternativePerspectives)
      ids.push(...alt.sourceIds);
  }
  return ids;
}

export function validateCaseStudySources(
  content: unknown,
  allowedSourceIds: string[],
) {
  const study = validateCaseStudy(content);
  const allowed = new Set(allowedSourceIds);
  const bad = collectCaseStudySourceIds(study).some((id) => !allowed.has(id));
  if (bad) {
    throw new BadRequestError(
      'Case study references an unselected or unavailable source',
    );
  }
  return { ...study, sourceIds: [...allowed] };
}

export function prepareGeneratedCaseStudy(
  content: unknown,
  sourceIds: string[],
  options?: Partial<CaseStudyGenerationOptions> & { questionCount?: number },
) {
  const study = validateCaseStudySources(content, sourceIds);
  const settings = CaseStudyOptions.parse({
    questionCount: options?.questionCount ?? study.questions.length,
    focus: options?.focus ?? study.conceptsFocus ?? '',
    comparePerspectives: options?.comparePerspectives ?? false,
  });
  if (study.questions.length !== settings.questionCount) {
    throw new BadRequestError(
      'Case study question count does not match the request',
    );
  }
  if (study.analyses.length !== study.questions.length) {
    throw new BadRequestError(
      'Case study must include an analysis for each question',
    );
  }
  if (!study.scenario.isFictional) {
    throw new BadRequestError('Case study scenarios must be fictional');
  }
  return { ...study, conceptsFocus: settings.focus };
}
