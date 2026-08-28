export interface FolderDTO {
  id: string;
  notebookId: string;
  parentId: string | null;
  name: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string | null;
}
