import { z } from 'zod';

/**
 * Grounding Mode supplement contract (#100).
 *
 * Moderate generations keep strict's source gates and citations, and add one
 * clearly-labeled general-knowledge section on top. The supplement travels as
 * a schema-compatible OPTIONAL top-level field so every stored material keeps
 * validating, strict outputs never gain it, and readers can render or ignore
 * it without a migration.
 */
export const GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD = 'generalKnowledgeSupplement';

/** Hard cap on the stored supplement, in line with the other long fields. */
export const GENERAL_KNOWLEDGE_SUPPLEMENT_MAX_CHARS = 4000;

/**
 * The label the model must start the supplement with, so the rendered
 * material clearly separates source-grounded content from general knowledge.
 */
export const GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL =
  'General knowledge supplement';

export const GeneralKnowledgeSupplementSchema = z
  .string()
  .max(GENERAL_KNOWLEDGE_SUPPLEMENT_MAX_CHARS)
  .optional();

/**
 * Reads a candidate supplement off arbitrary content. Returns undefined for
 * anything that is not a non-blank string, so blank or foreign values never
 * flow into storage.
 */
export function extractGeneralKnowledgeSupplement(
  content: unknown,
): string | undefined {
  if (!content || typeof content !== 'object') return undefined;
  const value = (content as Record<string, unknown>)[
    GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD
  ];
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  return value;
}

/**
 * Sanitizes a candidate supplement for storage: drops blank values and caps
 * the length. The native structured-output path already enforces the cap via
 * the schema; the JSON fallback path does not, so this is the backstop both
 * paths share.
 */
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

/**
 * Removes the supplement from stored content. The strict and free paths use
 * this defensively so a hallucinated field can never leak into storage: only
 * moderate generations persist a supplement.
 */
export function stripGeneralKnowledgeSupplement<
  T extends Record<string, unknown>,
>(content: T): T {
  if (!(GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD in content)) return content;
  const { [GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD]: _removed, ...rest } = content;
  void _removed;
  return rest as T;
}

/**
 * Moderate prompt directive: the sources still ground every factual claim
 * (citations apply as usual), and the model additionally fills the optional
 * supplement field with general-knowledge context under a clear label.
 */
export function moderateSupplementDirective(): string {
  return `

GROUNDING MODE: MODERATE
- Ground every factual claim in the supplied source material and cite it exactly as instructed above.
- Additionally fill the optional top-level "${GENERAL_KNOWLEDGE_SUPPLEMENT_FIELD}" string with helpful general-knowledge context that goes beyond what the sources cover. Start it with the label "${GENERAL_KNOWLEDGE_SUPPLEMENT_LABEL}: " so readers can tell it apart from source-grounded content.
- Omit the field only when the sources already cover everything; never leave it blank or invent source citations, source IDs, or evidence keys inside it.`;
}

/**
 * Free prompt directive for ungrounded generations: no notebook sources were
 * selected, so the model answers from the brief and its general knowledge
 * with no citations at all.
 */
export function freeUngroundedDirective(): string {
  return `

GROUNDING MODE: FREE
- No notebook sources were selected. Answer from the brief using your general knowledge.
- Do not invent source citations, source IDs, evidence keys, quotations, page numbers, or statistics. Leave every sourceIds field empty and cite nothing.`;
}
