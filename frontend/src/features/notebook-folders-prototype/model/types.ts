export type Notebook = {
  id: string;
  title: string;
  description: string;
  icon: string;
  coverUrl: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
