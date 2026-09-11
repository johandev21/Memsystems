// Folder geometry comes from the export; preview imagery comes from the local
// notebook seed and remains visible through the export's fixed crop slots.
// Folder thumbnails are 67-183px wide, so they use the small cover variants
// and let the browser pick per screen density.
import type { CoverVariants } from "./types";

export function getFolderCovers(notebooks: { coverUrl: string | null; coverVariants?: CoverVariants | null }[]) {
  return notebooks.slice(0, 2).map(({ coverUrl, coverVariants }) => {
    if (coverVariants) return coverVariants;
    // Notebooks without generated variants fall back to their single cover.
    return coverUrl ? { w240: coverUrl, w480: coverUrl, w960: coverUrl } : null;
  });
}
