export const GROUNDING_MODES = ['strict', 'moderate', 'free'] as const;

export type GroundingMode = (typeof GROUNDING_MODES)[number];

export const DEFAULT_GROUNDING_MODE: GroundingMode = 'strict';

export function isGroundingMode(value: unknown): value is GroundingMode {
  return (
    typeof value === 'string' &&
    (GROUNDING_MODES as readonly string[]).includes(value)
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
