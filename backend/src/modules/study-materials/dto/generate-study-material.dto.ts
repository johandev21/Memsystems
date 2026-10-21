import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  groundingModeSchema,
  studyMaterialKindSchema,
} from '../../../common/dto/shared-schemas';

export const generateRequestSchema = z.object({
  kind: studyMaterialKindSchema,
  brief: z
    .string()
    .default('')
    .describe('Brief with the instructions and options for the Generation.'),
  sourceIds: z
    .array(z.string())
    .default([])
    .describe('Sources selected as Evidence for the Generation.'),
  folderId: z
    .string()
    .nullable()
    .optional()
    .describe('Study Material Folder that should contain the result.'),
  model: z
    .string()
    .optional()
    .describe('Model identifier; defaults to the model chosen for the Kind.'),
  questionCount: z
    .number()
    .min(0)
    .max(50)
    .optional()
    .describe('Requested number of quiz questions or flashcards.'),
  difficulty: z
    .enum(['easy', 'medium', 'hard', 'auto'])
    .optional()
    .describe('Requested difficulty for quiz or flashcard Generation.'),
  groundingMode: groundingModeSchema.optional(),
  roadmapOptions: z
    .object({
      phaseCount: z.number().min(0).max(50),
      detailLevel: z.enum(['basic', 'detailed', 'auto']),
    })
    .optional()
    .describe('Roadmap-specific Generation options.'),
  mindMapOptions: z
    .object({
      nodeCount: z.number().min(0).max(100),
      structure: z.enum(['radial', 'hierarchical', 'organic']),
      colorGroups: z.union([z.boolean(), z.enum(['auto'])]),
      crossLinks: z.boolean(),
      detailLevel: z.enum(['basic', 'detailed', 'auto']),
    })
    .optional()
    .describe('Mind map-specific Generation options.'),
  language: z
    .string()
    .min(1)
    .max(35)
    .optional()
    .describe('Base Language code used for the material.'),
  slidesOptions: z
    .object({
      slideCount: z.number().min(0).max(20),
      theme: z.enum([
        'dark',
        'light',
        'accent',
        'editorial',
        'academic',
        'technical',
        'warm',
        'auto',
      ]),
      detailLevel: z.enum(['basic', 'detailed', 'auto']),
    })
    .optional()
    .describe('Slides-specific Generation options.'),
});

export class GenerateStudyMaterialDto extends createZodDto(
  generateRequestSchema,
) {}
