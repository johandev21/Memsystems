export const MAX_TITLE_LENGTH = 50;

export function clampTitle(value: string): string {
  return Array.from(value).slice(0, MAX_TITLE_LENGTH).join("");
}
