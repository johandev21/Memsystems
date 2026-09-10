// Folder geometry comes from the export; preview imagery comes from the local
// notebook seed and remains visible through the export's fixed crop slots.
export function getFolderCovers(notebooks: { coverUrl: string | null }[]) {
  return notebooks.slice(0, 2).map(({ coverUrl }) => coverUrl);
}
