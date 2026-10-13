import { z } from 'zod';
import {
  CITATION_SCHEMA_VERSION,
  extractCitationEntries,
  type CitationEvidence,
  type CitedSourceEntry,
} from '../chat/chat-citations';

export const GENERATION_CITATION_LIMIT = 200;

export const GenerationCitationLocatorSchema = z.object({
  pageNumber: z.number().finite().optional(),
  slideNumber: z.number().finite().optional(),
  startOffsetMs: z.number().finite().optional(),
  endOffsetMs: z.number().finite().optional(),
  speaker: z.string().max(500).optional(),
  sheetName: z.string().max(500).optional(),
  cellRange: z.string().max(200).optional(),
  symbol: z.string().max(500).optional(),
  lineStart: z.number().finite().optional(),
  lineEnd: z.number().finite().optional(),
  imageRegion: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().finite(),
      height: z.number().finite(),
    })
    .optional(),
});

export const GenerationCitationSchema: z.ZodType<CitedSourceEntry> = z.object({
  schemaVersion: z
    .number()
    .int()
    .nonnegative()
    .default(CITATION_SCHEMA_VERSION),
  citationKey: z.string().min(1).max(50),
  sourceId: z.string().min(1).max(200),
  chunkId: z.string().max(200).nullable().default(null),
  chunkIndex: z.number().int().nullable().default(null),
  sourceVersionId: z.string().max(200).nullable().default(null),
  locator: GenerationCitationLocatorSchema.nullable().default(null),
  number: z.number().int().positive(),
  title: z.string().max(1000).nullable().default(null),
  kind: z.string().max(100).nullable().default(null),
  url: z.string().max(4000).nullable().default(null),
  description: z.string().max(4000).nullable().default(null),
  quote: z.string().max(4000).nullable().default(null),
  attribution: z.enum(['explicit', 'nearest']).default('explicit'),
  sectionPath: z.array(z.string().max(500)).nullable().optional().default(null),
  context: z.string().max(4000).nullable().optional().default(null),
});

export const GenerationCitationsSchema = z
  .array(GenerationCitationSchema)
  .max(GENERATION_CITATION_LIMIT)
  .default([]);

export type GenerationCitation = z.infer<typeof GenerationCitationSchema>;

export function extractGenerationCitations(
  content: unknown,
  evidence: CitationEvidence[],
): CitedSourceEntry[] {
  if (evidence.length === 0) return [];
  let serialized: string;
  try {
    serialized = JSON.stringify(content) ?? '';
  } catch {
    return [];
  }
  if (!serialized.includes('[ref:') && !serialized.includes('#reference-')) {
    return [];
  }
  return extractCitationEntries(serialized, evidence).slice(
    0,
    GENERATION_CITATION_LIMIT,
  );
}

export function attachGenerationCitations<T extends object>(
  content: T,
  citations: CitedSourceEntry[],
): T & { citations: CitedSourceEntry[] } {
  return { ...content, citations: [...citations] };
}
