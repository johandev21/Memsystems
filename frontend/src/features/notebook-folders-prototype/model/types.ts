export type CoverVariants = {
  w240: string;
  w480: string;
  w960: string;
};

export type Notebook = {
  id: string;
  title: string;
  description: string;
  icon: string;
  coverUrl: string | null;
  coverVariants?: CoverVariants | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};
