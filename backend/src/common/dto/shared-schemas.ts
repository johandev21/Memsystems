import { z } from 'zod';

/**
 * Shared Zod schemas that appear in more than one request body.
 *
 * Each shared schema carries an explicit `id` so `z.toJSONSchema` (and
 * `cleanupOpenApiDoc`) emit a single reusable component instead of colliding
 * inline definitions with the same generated name.
 */
export const groundingModeSchema = z.enum(['strict', 'moderate', 'free']).meta({
  id: 'GroundingMode',
  description:
    'How tightly the AI must stay grounded in the notebook sources: strict, moderate, or free.',
});

export const studyMaterialKindSchema = z
  .enum(['quiz', 'simple_flashcard', 'roadmap', 'mind_map', 'slides'])
  .meta({
    id: 'StudyMaterialKind',
    description:
      'The kind of study material: quiz, simple flashcard, roadmap, mind map, or slides.',
  });
