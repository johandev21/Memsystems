import { z } from 'zod';

export const GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD = 'generalKnowledgeSupplement';

export const GENERAL_KNOWLEDGE_SUPPLEMENT_MAX_CHARS = 4000;

export const GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL =
  'General knowledge supplement';

export const GeneralKnowledgeSupplementSchema = z
  .string()
  .max(GENERAL_KNOWLEDGE_SUPPLEMENT_MAX_CHARS)
  .optional();

export function sanitizeGeneralKnowledgeSupplement(
  value: unknown,
): string | undefined {
  const raw =
    value !== null &&
    typeof value === 'object' &&
    GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD in (value as Record<string, unknown>)
      ? (value as Record<string, unknown>)[GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]
      : value;
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined;
  return raw.length > GENERAL_KNOWLEDGE_SUPPLEMENT_MAX_CHARS
    ? raw.slice(0, GENERAL_KNOWLEDGE_SUPPLEMENT_MAX_CHARS)
    : raw;
}

export function stripGeneralKnowledgeSupplement<
  T extends Record<string, unknown>,
>(content: T): T {
  if (!(GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD in content)) return content;
  const { [GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]: _removed, ...rest } = content;
  void _removed;
  return rest as T;
}

export function moderateSupplementDirective(): string {
  return `

GROUNDING MODE: MODERATE
- Ground every factual claim in the supplied source material and cite it exactly as instructed above.
- Additionally fill the optional top-level "${GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD}" string with helpful general-knowledge context that goes beyond what the sources cover. Start it with the label "${GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL}: " so readers can tell it apart from source-grounded content.
- Omit the field only when the sources already cover everything; never leave it blank or invent source citations, source IDs, or evidence keys inside it.`;
}

export function freeUngroundedDirective(): string {
  return `

GROUNDING MODE: FREE
- No notebook sources were selected. Answer from the brief using your general knowledge.
- Do not invent source citations, source IDs, evidence keys, quotations, page numbers, or statistics. Leave every sourceIds field empty and cite nothing.`;
}
