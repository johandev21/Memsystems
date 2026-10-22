import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const webSearchImportCandidateSchema = z.object({
  url: z.string().url('Must be a valid URL').describe('Candidate URL.'),
  title: z.string().max(500).optional().describe('Candidate title.'),
  description: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .describe('Candidate description from the web search result.'),
});

export const webSearchImportSchema = z.object({
  candidates: z
    .array(webSearchImportCandidateSchema)
    .min(1, 'At least one candidate is required')
    .max(50, 'Up to 50 candidates allowed per import')
    .describe('Web Search candidates to import as sources.'),
  query: z
    .string()
    .max(500)
    .optional()
    .describe('Original Web Search query, recorded with the import.'),
});

export class ImportWebSearchResultsDto extends createZodDto(
  webSearchImportSchema,
) {}
