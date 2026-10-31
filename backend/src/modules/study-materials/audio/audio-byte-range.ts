/** Unsupported/multipart ranges are ignored; unsatisfiable single ranges receive 416. */
export function audioByteRange(
  header: string | undefined,
  length: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, length - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    (!match[1] && Number(match[2]) === 0) ||
    start >= length ||
    start > end
  )
    return 'unsatisfiable';
  return { start, end };
}
