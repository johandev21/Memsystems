import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateStudyMaterialFolderSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe('New study material folder name.'),
  parentId: z
    .string()
    .nullable()
    .optional()
    .describe(
      'New parent study material folder, or null for the notebook root.',
    ),
});

export class UpdateStudyMaterialFolderDto extends createZodDto(
  updateStudyMaterialFolderSchema,
) {}
