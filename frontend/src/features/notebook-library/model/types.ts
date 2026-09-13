export type CoverVariants = {
  w240: string | null;
  w480: string | null;
  w960: string | null;
};

export type LibraryFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryNotebook = {
  id: string;
  title: string;
  description: string;
  icon: string;
  coverUrl: string | null;
  coverVariants: CoverVariants | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Draft = { kind: "folder" | "notebook"; id: string };
