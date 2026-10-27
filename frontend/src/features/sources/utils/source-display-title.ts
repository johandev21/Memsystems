import type { Source } from "../types/source.types";

export function sourceDisplayTitle(source: Pick<Source, "kind" | "title">): string {
  if (source.kind !== "file") return source.title;
  const extensionIndex = source.title.lastIndexOf(".");
  return extensionIndex > 0 && extensionIndex < source.title.length - 1
    ? source.title.slice(0, extensionIndex)
    : source.title;
}
