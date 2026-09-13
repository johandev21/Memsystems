import { apiDelete, apiPatch, apiPost, createQueryOptions } from "@/shared/api";
import type { Notebook } from "@/features/notebooks/types";

export interface LibraryFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryResponse {
  folders: LibraryFolder[];
  notebooks: Notebook[];
}

export interface CreateLibraryFolderInput {
  name: string;
  parentId?: string | null;
}

export interface UpdateLibraryFolderInput {
  name?: string;
  parentId?: string | null;
}

export const libraryQueryOptions = createQueryOptions<LibraryResponse>(
  ["library"],
  "/api/library",
  { staleTime: 15_000, refetchOnMount: "always" },
);

export const createLibraryFolder = (input: CreateLibraryFolderInput) =>
  apiPost<CreateLibraryFolderInput, LibraryFolder>("/api/library/folders", input);

export const updateLibraryFolder = (id: string, input: UpdateLibraryFolderInput) =>
  apiPatch<UpdateLibraryFolderInput, LibraryFolder>(`/api/library/folders/${id}`, input);

export const deleteLibraryFolder = (id: string) => apiDelete(`/api/library/folders/${id}`);
