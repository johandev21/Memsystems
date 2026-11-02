export const MAX_SLIDES = 20;
export const MAX_ELEMENTS_PER_SLIDE = 6;
export const MAX_ELEMENTS_PER_DECK = 120;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}
