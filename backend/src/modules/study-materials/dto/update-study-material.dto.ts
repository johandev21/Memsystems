import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateStudyMaterialSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe('New study material title.'),
  content: z
    .unknown()
    .optional()
    .describe('Replacement kind-specific study material content.'),
});

export class UpdateStudyMaterialDto extends createZodDto(
  updateStudyMaterialSchema,
) {}
