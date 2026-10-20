import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addTranscriptSchema = z.object({
  transcriptText: z
    .string()
    .min(1, 'Transcript text is required')
    .describe(
      'Transcript text to attach to the source as a new source version.',
    ),
});

export class AddTranscriptDto extends createZodDto(addTranscriptSchema) {}
