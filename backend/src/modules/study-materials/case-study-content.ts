import { z } from 'zod';
import { GenerationCitationsSchema } from './generation-citations';
import { BadRequestError } from '../../common/errors/domain-error';

export const CaseStudyOptions = z.object({
  // 0 means auto: the model chooses the number of questions.
  questionCount: z.number().int().min(0).max(10).default(0),
  focus: z.string().max(2000).default(''),
  comparePerspectives: z.enum(['auto', 'single', 'compare']).default('auto'),
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
  citations: GenerationCitationsSchema,
});

export function validateCaseStudy(content: unknown) {
  const result = CaseStudyContent.safeParse(content);
  if (!result.success)
    throw new BadRequestError('Invalid case study content', {
      messageKey: 'errors.studyMaterials.caseStudy.invalidContent',
    });
  const study = result.data;
  if (
    new Set(study.questions.map((q) => q.id)).size !== study.questions.length
  ) {
    throw new BadRequestError('Case study question IDs must be unique', {
      messageKey: 'errors.studyMaterials.caseStudy.questionIdsUnique',
    });
  }
  const questionIds = new Set(study.questions.map((q) => q.id));
  if (
    new Set(study.analyses.map((a) => a.questionId)).size !==
    study.analyses.length
  ) {
    throw new BadRequestError(
      'Case study analysis question IDs must be unique',
      {
        messageKey: 'errors.studyMaterials.caseStudy.analysisQuestionIdsUnique',
      },
    );
  }
  for (const analysis of study.analyses) {
    if (!questionIds.has(analysis.questionId)) {
      throw new BadRequestError(
        'Case study analysis references an unknown question',
        {
          messageKey: 'errors.studyMaterials.caseStudy.unknownQuestion',
        },
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
      { messageKey: 'errors.studyMaterials.caseStudy.sourceUnavailable' },
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
    comparePerspectives: options?.comparePerspectives ?? 'auto',
  });
  // Auto (0) accepts whatever the model produced; only an explicit request is
  // checked against the output.
  if (
    settings.questionCount > 0 &&
    study.questions.length !== settings.questionCount
  ) {
    throw new BadRequestError(
      'Case study question count does not match the request',
      { messageKey: 'errors.studyMaterials.caseStudy.questionCountMismatch' },
    );
  }
  if (study.analyses.length !== study.questions.length) {
    throw new BadRequestError(
      'Case study must include an analysis for each question',
      { messageKey: 'errors.studyMaterials.caseStudy.missingAnalysis' },
    );
  }
  if (!study.scenario.isFictional) {
    throw new BadRequestError('Case study scenarios must be fictional', {
      messageKey: 'errors.studyMaterials.caseStudy.mustBeFictional',
    });
  }
  return { ...study, conceptsFocus: settings.focus };
}
