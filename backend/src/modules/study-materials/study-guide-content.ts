import { z } from 'zod';
import { GenerationCitationsSchema } from './generation-citations';
import { BadRequestError } from '../../common/errors/domain-error';

export const StudyGuideOptions = z.object({
  format: z.enum(['detailed', 'revision', 'auto']).default('auto'),
  // 0 means auto: the model chooses the number of sections.
  sectionCount: z.number().int().min(0).max(12).default(0),
});
export type StudyGuideGenerationOptions = z.infer<typeof StudyGuideOptions>;

export const StudyGuideSection = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(12000),
  keyConcepts: z.array(z.string().min(1).max(2000)).min(1).max(20),
  examples: z.array(z.string().min(1).max(4000)).max(5),
  misconceptions: z.array(z.string().min(1).max(2000)).max(10).default([]),
  takeaways: z.array(z.string().min(1).max(2000)).max(10).default([]),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
});

export const StudyGuideContent = z.object({
  title: z.string().min(1).max(200),
  overview: z.string().min(1).max(5000),
  learningObjectives: z.array(z.string().min(1).max(1000)).min(1).max(20),
  format: z.enum(['detailed', 'revision']).default('detailed'),
  sourceIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  sections: z.array(StudyGuideSection).min(1).max(12),
  citations: GenerationCitationsSchema,
});

export function validateStudyGuide(content: unknown) {
  const result = StudyGuideContent.safeParse(content);
  if (!result.success)
    throw new BadRequestError('Invalid study guide content', {
      messageKey: 'errors.studyMaterials.studyGuide.invalidContent',
    });
  const guide = result.data;
  if (
    new Set(guide.sections.map((section) => section.id)).size !==
    guide.sections.length
  ) {
    throw new BadRequestError('Study guide section IDs must be unique', {
      messageKey: 'errors.studyMaterials.studyGuide.sectionIdsUnique',
    });
  }
  return guide;
}

export function validateStudyGuideSources(
  content: unknown,
  allowedSourceIds: string[],
) {
  const guide = validateStudyGuide(content);
  const allowed = new Set(allowedSourceIds);
  if (
    guide.sections.some((section) =>
      section.sourceIds.some((id) => !allowed.has(id)),
    )
  ) {
    throw new BadRequestError(
      'Study guide references an unselected or unavailable source',
      { messageKey: 'errors.studyMaterials.studyGuide.sourceUnavailable' },
    );
  }
  return { ...guide, sourceIds: [...allowed] };
}

export function prepareGeneratedStudyGuide(
  content: unknown,
  sourceIds: string[],
  options?: StudyGuideGenerationOptions,
) {
  const guide = validateStudyGuideSources(content, sourceIds);
  const settings = StudyGuideOptions.parse(options ?? {});
  // 'auto' means the model decided, so the detailed-extras gate does not apply.
  if (
    settings.format === 'detailed' &&
    guide.sections.some(
      (section) =>
        !section.examples.length ||
        !section.misconceptions.length ||
        !section.takeaways.length,
    )
  ) {
    throw new BadRequestError(
      'Detailed study guides require examples, misconceptions, and takeaways in each section',
      { messageKey: 'errors.studyMaterials.studyGuide.detailedRequiresExtras' },
    );
  }
  if (
    settings.sectionCount > 0 &&
    guide.sections.length !== settings.sectionCount
  ) {
    throw new BadRequestError(
      'Study guide section count does not match the request',
      { messageKey: 'errors.studyMaterials.studyGuide.countMismatch' },
    );
  }
  return {
    ...guide,
    format: settings.format === 'auto' ? guide.format : settings.format,
  };
}
