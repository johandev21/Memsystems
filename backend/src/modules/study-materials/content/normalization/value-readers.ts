export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const toArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

export const stringify = (value: unknown): string =>
  typeof value === 'string' ? value : String(value);

export const citationsField = (content: unknown): unknown[] =>
  isRecord(content) && Array.isArray(content.citations)
    ? (content.citations as unknown[])
    : [];
