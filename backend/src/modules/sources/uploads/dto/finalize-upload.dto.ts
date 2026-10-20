import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const finalizeUploadSchema = z.object({
  title: z
    .string()
    .trim()
    .max(500)
    .optional()
    .describe('Optional title for the resulting source.'),
});

export class FinalizeUploadDto extends createZodDto(finalizeUploadSchema) {}
