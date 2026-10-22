import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createTextSourceSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500)
    .describe('Title of the source.'),
  rawText: z
    .string()
    .min(1, 'rawText is required')
    .describe('Plain text content to ingest as a source.'),
});

export class CreateTextSourceDto extends createZodDto(createTextSourceSchema) {}
