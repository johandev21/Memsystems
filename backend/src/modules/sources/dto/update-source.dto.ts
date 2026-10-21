import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateSourceSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(500)
    .optional()
    .describe('New source title.'),
});

export class UpdateSourceDto extends createZodDto(updateSourceSchema) {}
