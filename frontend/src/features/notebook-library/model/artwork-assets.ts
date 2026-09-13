// Folder artwork shows up to two notebook covers as its preview. Cover
// variants are presigned URLs; a notebook without generated variants falls
// back to its single cover URL so the crop slots never render empty.
import type { CoverVariants } from "./types";

export type NotebookCoverSource = {
  coverUrl: string | null;
  coverVariants?: CoverVariants | null;
};

export function getFolderCovers(notebooks: NotebookCoverSource[]) {
  return notebooks.slice(0, 2).map(({ coverUrl, coverVariants }) => {
    if (coverVariants) return coverVariants;
    return coverUrl ? { w240: coverUrl, w480: coverUrl, w960: coverUrl } : null;
  });
}

/** Best single URL for a cover slot, preferring the 480w variant. */
export function primaryCoverUrl(
  variants: CoverVariants | null | undefined,
): string | null {
  if (!variants) return null;
  return variants.w480 ?? variants.w960 ?? variants.w240 ?? null;
}

/** Builds a `srcset` from whichever variant widths exist. */
export function coverSrcSet(
  variants: CoverVariants | null | undefined,
  widths: readonly (keyof CoverVariants)[],
): string | undefined {
  if (!variants) return undefined;
  const entries: string[] = [];
  for (const width of widths) {
    const url = variants[width];
    if (url) entries.push(`${url} ${width.slice(1)}w`);
  }
  return entries.length > 0 ? entries.join(", ") : undefined;
}
