import { z } from 'zod';

export const groundingModeSchema = z.enum(['strict', 'moderate', 'free']).meta({
  id: 'GroundingMode',
  description:
    'How tightly the AI must stay grounded in the notebook sources: strict, moderate, or free.',
});

export const studyMaterialKindSchema = z
  .enum([
    'quiz',
    'simple_flashcard',
    'roadmap',
    'mind_map',
    'slides',
    'audio_overview',
  ])
  .meta({
    id: 'StudyMaterialKind',
    description:
      'The kind of study material: quiz, simple flashcard, roadmap, mind map, slides, or audio overview.',
  });
