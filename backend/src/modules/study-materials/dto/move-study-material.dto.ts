import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const moveStudyMaterialSchema = z.object({
  folderId: z
    .string()
    .nullable()
    .describe(
      'Study Material Folder to move the material into, or null for the notebook root.',
    ),
});

export class MoveStudyMaterialDto extends createZodDto(
  moveStudyMaterialSchema,
) {}
