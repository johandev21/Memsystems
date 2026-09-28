import { useQuery } from "@tanstack/react-query";
import { notebookQueryOptions } from "../api/notebooks";

export type GroundingMode = "strict" | "moderate" | "free";

export const GROUNDING_MODES: readonly GroundingMode[] = ["strict", "moderate", "free"];

export const DEFAULT_GROUNDING_MODE: GroundingMode = "strict";

export function isGroundingMode(value: unknown): value is GroundingMode {
  return (
    typeof value === "string" && (GROUNDING_MODES as readonly string[]).includes(value)
  );
}

export function resolveGroundingMode(
  override: unknown,
  notebookValue: unknown,
): GroundingMode {
  if (isGroundingMode(override)) return override;
  if (isGroundingMode(notebookValue)) return notebookValue;
  return DEFAULT_GROUNDING_MODE;
}

/**
 * The notebook's Grounding Mode, defaulting to strict while the query is
 * pending or when the server predates the field. Mirrors the backend
 * fallback (per-request override ?? notebook value ?? strict).
 */
export function useNotebookGroundingMode(notebookId: string): GroundingMode {
  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  return resolveGroundingMode(undefined, notebook?.groundingMode);
}

/**
 * Whether the generation brief form may submit. Strict and Moderate keep the
 * historical rule (at least one source or a non-empty brief); Free also
 * allows a fully empty brief-only request, which the backend answers from
 * general knowledge.
 */
export function canSubmitBrief(
  groundingMode: GroundingMode,
  hasSources: boolean,
  hasInstructions: boolean,
  disabled = false,
): boolean {
  if (disabled) return false;
  if (groundingMode === "free") return true;
  return hasSources || hasInstructions;
}
