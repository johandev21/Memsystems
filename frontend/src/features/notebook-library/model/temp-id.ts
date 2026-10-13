export const TEMP_ID_PREFIX = "tmp-";

export function createTempId(): string {
  return `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
}

export function isTempId(id: string | null | undefined): id is string {
  return typeof id === "string" && id.startsWith(TEMP_ID_PREFIX);
}
