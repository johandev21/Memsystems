import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const webSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Query is required')
    .max(500)
    .describe('Web Search query used to discover candidate sources.'),
});

export class WebSearchDto extends createZodDto(webSearchSchema) {}
