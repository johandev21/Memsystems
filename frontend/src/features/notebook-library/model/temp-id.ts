// Client-side ids for optimistic creates. Server ids are cuid2 values, which
// never contain a dash, so the prefix cannot collide with a real id.
export const TEMP_ID_PREFIX = "tmp-";

export function createTempId(): string {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isTempId(id: string | null | undefined): id is string {
  return typeof id === "string" && id.startsWith(TEMP_ID_PREFIX);
}
