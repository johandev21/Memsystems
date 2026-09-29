import { apiDelete, apiPatch, apiPost, createQueryOptions } from "@/shared/api";
import type { SourceFolder } from "../types/source-folder.types";

export type { SourceFolder };

export interface CreateSourceFolderInput {
  name: string;
  parentId?: string | null;
}

export interface UpdateSourceFolderInput {
  name?: string;
  parentId?: string | null;
}

export const sourceFoldersQueryOptions = (notebookId: string) =>
  createQueryOptions<SourceFolder[]>(
    ["source-folders", notebookId],
    `/api/notebooks/${notebookId}/source-folders`,
  );

export const createSourceFolder = (
  notebookId: string,
  input: CreateSourceFolderInput,
) =>
  apiPost<CreateSourceFolderInput, SourceFolder>(
    `/api/notebooks/${notebookId}/source-folders`,
    input,
  );

export const updateSourceFolder = (
  folderId: string,
  input: UpdateSourceFolderInput,
) =>
  apiPatch<UpdateSourceFolderInput, SourceFolder>(
    `/api/source-folders/${folderId}`,
    input,
  );

export const deleteSourceFolder = (folderId: string) =>
  apiDelete(`/api/source-folders/${folderId}`);
