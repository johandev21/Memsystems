export const MAX_TITLE_LENGTH = 50;

export function clampTitle(value: string): string {
  return Array.from(value).slice(0, MAX_TITLE_LENGTH).join("");
}

/**
 * Formats long URLs with middle-truncation so the host and target slug are visible,
 * preventing identical 'https://example.co...' end-truncation.
 */
export function formatDisplayTitle(title: string): string {
  if (/^https?:\/\//i.test(title) && title.length > 36) {
    try {
      const u = new URL(title);
      const host = u.host;
      const path = u.pathname;
      const segments = path.split("/").filter(Boolean);
      if (segments.length > 1) {
        return `${host}/.../${segments.at(-1)}`;
      }
      if (path.length > 15) {
        return `${host}${path.slice(0, 10)}...${path.slice(-8)}`;
      }
      return `${host}${path}`;
    } catch {
      return `${title.slice(0, 20)}...${title.slice(-12)}`;
    }
  }
  return title;
}
