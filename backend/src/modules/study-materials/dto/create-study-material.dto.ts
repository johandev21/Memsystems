import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { studyMaterialKindSchema } from '../../../common/dto/shared-schemas';

export const createStudyMaterialSchema = z.object({
  kind: studyMaterialKindSchema,
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200)
    .describe('Title of the study material.'),
  content: z.unknown().describe('Kind-specific study material content object.'),
  folderId: z
    .string()
    .optional()
    .describe('Study Material Folder that should contain the material.'),
});

export class CreateStudyMaterialDto extends createZodDto(
  createStudyMaterialSchema,
) {}
