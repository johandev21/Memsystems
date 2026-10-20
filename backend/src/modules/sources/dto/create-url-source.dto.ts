import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createUrlSourceSchema = z.object({
  url: z
    .string()
    .min(1, 'URL or identifier is required')
    .max(2048)
    .describe('URL or provider identifier of the source to ingest.'),
  title: z.string().max(500).optional().describe('Optional source title.'),
  oauthToken: z
    .string()
    .max(2048)
    .optional()
    .describe('Optional OAuth token for providers that require one.'),
  captionText: z
    .string()
    .max(1024 * 1024)
    .optional()
    .describe('Optional caption or transcript text supplied by the client.'),
  captionFormat: z
    .enum(['vtt', 'srt', 'json3', 'xml', 'plain', 'auto'])
    .optional()
    .describe('Format of the supplied caption text.'),
});

export class CreateUrlSourceDto extends createZodDto(createUrlSourceSchema) {}
