import { z } from "zod";
import type { LibrarySortKey } from "./library-sort";

export const librarySearchSchema = z.object({
  folderId: z.string().optional(),
  sort: z.enum(["name", "updatedAt", "createdAt"]).optional(),
  view: z.enum(["library", "trash"]).optional(),
});

export type LibrarySearch = {
  folderId?: string;
  sort?: LibrarySortKey;
  view?: "library" | "trash";
};

export function parseLibrarySearch(search: Record<string, unknown>): LibrarySearch {
  const parsed = librarySearchSchema.catch({}).parse(search);
  const trimmed = parsed.folderId?.trim();
  return {
    ...(trimmed ? { folderId: trimmed } : {}),
    ...(parsed.sort ? { sort: parsed.sort } : {}),
    ...(parsed.view ? { view: parsed.view } : {}),
  };
}
