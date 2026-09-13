import type { Notebook } from "@/features/notebooks/types";
import type { CoverVariants, LibraryNotebook } from "./types";

export function toCoverVariants(
  variants: Notebook["bannerVariants"],
): CoverVariants | null {
  if (!variants) return null;
  const cover: CoverVariants = {
    w240: variants.w240,
    w480: variants.w480,
    w960: variants.w960,
  };
  return cover.w240 || cover.w480 || cover.w960 ? cover : null;
}

export function toLibraryNotebook(notebook: Notebook): LibraryNotebook {
  return {
    id: notebook.id,
    title: notebook.title,
    description: notebook.description,
    icon: notebook.icon,
    coverUrl: notebook.bannerUrl,
    coverVariants: toCoverVariants(notebook.bannerVariants),
    folderId: notebook.folderId,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
  };
}
