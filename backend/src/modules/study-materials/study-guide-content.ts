import { z } from 'zod';
import { BadRequestError } from '../../common/errors/domain-error';

export const StudyGuideOptions = z.object({
  format: z.enum(['detailed', 'revision']).default('detailed'),
  sectionCount: z.number().int().min(1).max(12).default(6),
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
});

export function validateStudyGuide(content: unknown) {
  const result = StudyGuideContent.safeParse(content);
  if (!result.success) throw new BadRequestError('Invalid study guide content');
  const guide = result.data;
  if (
    new Set(guide.sections.map((section) => section.id)).size !==
    guide.sections.length
  ) {
    throw new BadRequestError('Study guide section IDs must be unique');
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
    );
  }
  if (guide.sections.length !== settings.sectionCount) {
    throw new BadRequestError(
      'Study guide section count does not match the request',
    );
  }
  return { ...guide, format: settings.format };
}
