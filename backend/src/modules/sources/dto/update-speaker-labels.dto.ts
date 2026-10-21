import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const updateSpeakerLabelsSchema = z.object({
  speakerMap: z
    .record(z.string().min(1), z.string().min(1))
    .describe('Map of raw speaker labels to display names.'),
});

export class UpdateSpeakerLabelsDto extends createZodDto(
  updateSpeakerLabelsSchema,
) {}
