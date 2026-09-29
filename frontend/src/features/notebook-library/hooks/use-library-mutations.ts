import { useRef } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  createNotebook as createNotebookApi,
  deleteNotebook as deleteNotebookApi,
  updateNotebook as updateNotebookApi,
} from "@/features/notebooks/api/notebooks";
import type { Notebook } from "@/features/notebooks/types";
import {
  createLibraryFolder,
  deleteLibraryFolder,
  libraryQueryOptions,
  updateLibraryFolder,
  type LibraryResponse,
} from "../api/library";
import { createTempId, isTempId } from "../model/temp-id";

type LibraryData = LibraryResponse;

export interface UpdateFolderLibraryInput {
  name?: string;
  parentId?: string | null;
}

export interface UpdateNotebookLibraryInput {
  title?: string;
  description?: string;
  folderId?: string | null;
}

function patchLibrary(queryClient: QueryClient, updater: (current: LibraryData) => LibraryData) {
  queryClient.setQueryData<LibraryData>(libraryQueryOptions.queryKey, (current) =>
    current ? updater(current) : current,
  );
}

function patchNotebookDetail(
  queryClient: QueryClient,
  id: string,
  updater: (current: Notebook) => Notebook,
) {
  queryClient.setQueryData<Notebook>(["notebooks", id], (current) =>
    current ? updater(current) : current,
  );
}

function toastWithRetry(message: string, retryLabel: string, retry: () => void) {
  toast.error(message, { action: { label: retryLabel, onClick: retry } });
}

/**
 * Library mutations are optimistic end-to-end:
 * - creates insert a client-id card immediately and swap it for the server row
 *   once the POST resolves; queued renames/moves wait on the real id,
 * - updates/deletes patch the cache first and roll back on failure,
 * - no blanket invalidation runs on settle, so nothing flickers or reorders
 *   behind the user's back.
 */
export function useLibraryMutations() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("notebooks");
  const pendingCreates = useRef(new Map<string, Promise<string | null>>());
  const serverIdByTempId = useRef(new Map<string, string>());
  const pendingNames = useRef(new Map<string, string>());

  const resolveId = async (id: string): Promise<string | null> => {
    if (!isTempId(id)) return id;
    const serverId = serverIdByTempId.current.get(id);
    if (serverId) return serverId;
    const pending = pendingCreates.current.get(id);
    return pending ? await pending : null;
  };

  const createFolderMutation = useMutation({
    mutationFn: ({
      name,
      parentId,
    }: {
      tempId: string;
      name: string;
      parentId: string | null;
      onCreated?: (tempId: string, serverId: string) => void;
    }) => createLibraryFolder({ name, parentId }),
    onMutate: ({ tempId, name, parentId }) => {
      void queryClient.cancelQueries({ queryKey: libraryQueryOptions.queryKey });
      const now = new Date().toISOString();
      patchLibrary(queryClient, (current) => ({
        ...current,
        folders: [
          ...current.folders,
          { id: tempId, name, parentId, createdAt: now, updatedAt: now },
        ],
      }));
    },
    onSuccess: (folder, { tempId, onCreated }) => {
      // Report the server id before the cache swap. Callers that keep the draft
      // keyed by its stable id must update first, otherwise the card remounts
      // between the two updates and the open rename editor is lost.
      onCreated?.(tempId, folder.id);
      const pendingName = pendingNames.current.get(tempId);
      pendingNames.current.delete(tempId);
      const row = pendingName ? { ...folder, name: pendingName } : folder;
      patchLibrary(queryClient, (current) => ({
        ...current,
        folders: current.folders.map((item) => (item.id === tempId ? row : item)),
      }));
    },
    onError: (_error, { tempId }) => {
      patchLibrary(queryClient, (current) => ({
        ...current,
        folders: current.folders.filter((item) => item.id !== tempId),
      }));
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateFolderLibraryInput) =>
      updateLibraryFolder(id, input),
    onMutate: ({ id, ...input }) => {
      const previous = queryClient.getQueryData<LibraryData>(libraryQueryOptions.queryKey);
      void queryClient.cancelQueries({ queryKey: libraryQueryOptions.queryKey });
      const now = new Date().toISOString();
      patchLibrary(queryClient, (current) => ({
        ...current,
        folders: current.folders.map((folder) =>
          folder.id === id
            ? {
                ...folder,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
                updatedAt: now,
              }
            : folder,
        ),
      }));
      return { previous };
    },
    onSuccess: (folder) => {
      patchLibrary(queryClient, (current) => ({
        ...current,
        folders: current.folders.map((item) => (item.id === folder.id ? folder : item)),
      }));
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(libraryQueryOptions.queryKey, context.previous);
      }
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => deleteLibraryFolder(id),
    onMutate: (id: string) => {
      const previous = queryClient.getQueryData<LibraryData>(libraryQueryOptions.queryKey);
      void queryClient.cancelQueries({ queryKey: libraryQueryOptions.queryKey });
      const parentId = previous?.folders.find((folder) => folder.id === id)?.parentId ?? null;
      patchLibrary(queryClient, (current) => ({
        folders: current.folders
          .filter((folder) => folder.id !== id)
          .map((folder) => (folder.parentId === id ? { ...folder, parentId } : folder)),
        notebooks: current.notebooks.map((notebook) =>
          notebook.folderId === id ? { ...notebook, folderId: parentId } : notebook,
        ),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(libraryQueryOptions.queryKey, context.previous);
      }
    },
  });

  const createNotebookMutation = useMutation({
    mutationFn: ({
      title,
      folderId,
    }: {
      tempId: string;
      title: string;
      folderId: string | null;
      onCreated?: (tempId: string, serverId: string) => void;
    }) => createNotebookApi({ title, folderId }),
    onMutate: ({ tempId, title, folderId }) => {
      void queryClient.cancelQueries({ queryKey: libraryQueryOptions.queryKey });
      const now = new Date().toISOString();
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: [
          ...current.notebooks,
          {
            id: tempId,
            title,
            description: "",
            icon: "notebook",
            folderId,
            banner: null,
            bannerUrl: null,
            bannerVariants: null,
            bannerFocalPoint: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }));
    },
    onSuccess: (notebook, { tempId, onCreated }) => {
      // Report the server id before the cache swap. Callers that keep the draft
      // keyed by its stable id must update first, otherwise the card remounts
      // between the two updates and the open rename editor is lost.
      onCreated?.(tempId, notebook.id);
      const pendingTitle = pendingNames.current.get(tempId);
      pendingNames.current.delete(tempId);
      const row = pendingTitle ? { ...notebook, title: pendingTitle } : notebook;
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: current.notebooks.map((item) => (item.id === tempId ? row : item)),
      }));
    },
    onError: (_error, { tempId }) => {
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: current.notebooks.filter((item) => item.id !== tempId),
      }));
    },
  });

  const updateNotebookMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateNotebookLibraryInput) =>
      updateNotebookApi(id, input),
    onMutate: ({ id, ...input }) => {
      const previousLibrary = queryClient.getQueryData<LibraryData>(libraryQueryOptions.queryKey);
      const previousDetail = queryClient.getQueryData<Notebook>(["notebooks", id]);
      void queryClient.cancelQueries({ queryKey: libraryQueryOptions.queryKey });
      const now = new Date().toISOString();
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: current.notebooks.map((notebook) =>
          notebook.id === id ? { ...notebook, ...input, updatedAt: now } : notebook,
        ),
      }));
      patchNotebookDetail(queryClient, id, (current) => ({ ...current, ...input }));
      return { previousLibrary, previousDetail };
    },
    onSuccess: (notebook) => {
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: current.notebooks.map((item) => (item.id === notebook.id ? notebook : item)),
      }));
      patchNotebookDetail(queryClient, notebook.id, () => notebook);
    },
    onError: (_error, { id }, context) => {
      if (context?.previousLibrary) {
        queryClient.setQueryData(libraryQueryOptions.queryKey, context.previousLibrary);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(["notebooks", id], context.previousDetail);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["notebooks", id] });
      }
    },
  });

  const deleteNotebookMutation = useMutation({
    mutationFn: (id: string) => deleteNotebookApi(id),
    onMutate: (id: string) => {
      const previous = queryClient.getQueryData<LibraryData>(libraryQueryOptions.queryKey);
      void queryClient.cancelQueries({ queryKey: libraryQueryOptions.queryKey });
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: current.notebooks.filter((notebook) => notebook.id !== id),
      }));
      return { previous };
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ["notebooks", id] });
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(libraryQueryOptions.queryKey, context.previous);
      }
    },
  });

  const createFolder = (
    input: { name: string; parentId: string | null },
    onCreated?: (tempId: string, serverId: string) => void,
  ) => {
    const tempId = createTempId();
    const promise = createFolderMutation
      .mutateAsync({ tempId, ...input, onCreated })
      .then((folder) => {
        serverIdByTempId.current.set(tempId, folder.id);
        return folder.id;
      })
      .catch(() => {
        toastWithRetry(t("library.toasts.folderCreateFailed"), t("library.retry"), () => {
          void createFolder(input);
        });
        return null;
      });
    pendingCreates.current.set(tempId, promise);
    void promise.finally(() => pendingCreates.current.delete(tempId));
    return { tempId, promise };
  };

  const updateFolder = async (id: string, input: UpdateFolderLibraryInput) => {
    if (isTempId(id) && input.name !== undefined) {
      if (pendingCreates.current.has(id)) pendingNames.current.set(id, input.name);
      // Show the typed name on the temp card right away instead of waiting for
      // the create round-trip; the swap applies the same name to the server row.
      patchLibrary(queryClient, (current) => ({
        ...current,
        folders: current.folders.map((folder) =>
          folder.id === id ? { ...folder, name: input.name! } : folder,
        ),
      }));
    }
    const realId = await resolveId(id);
    pendingNames.current.delete(id);
    if (!realId) return undefined;
    let parentId = input.parentId;
    if (parentId !== undefined && parentId !== null) {
      const realParentId = await resolveId(parentId);
      if (!realParentId) return undefined;
      parentId = realParentId;
    }
    try {
      return await updateFolderMutation.mutateAsync({
        id: realId,
        ...input,
        ...(parentId !== undefined ? { parentId } : {}),
      });
    } catch {
      toastWithRetry(t("library.toasts.folderUpdateFailed"), t("library.retry"), () => {
        void updateFolder(id, input);
      });
      return undefined;
    }
  };

  const deleteFolder = async (id: string) => {
    if (isTempId(id) && pendingCreates.current.has(id)) {
      // Dismissing a pending create is instant: drop the temp card now and
      // delete the server row once the POST settles.
      patchLibrary(queryClient, (current) => ({
        ...current,
        folders: current.folders.filter((item) => item.id !== id),
      }));
    }
    const realId = await resolveId(id);
    if (!realId) return false;
    try {
      await deleteFolderMutation.mutateAsync(realId);
      return true;
    } catch {
      toastWithRetry(t("library.toasts.folderRemoveFailed"), t("library.retry"), () => {
        void deleteFolder(id);
      });
      return false;
    }
  };

  const createNotebook = (
    input: { title: string; folderId: string | null },
    onCreated?: (tempId: string, serverId: string) => void,
  ) => {
    const tempId = createTempId();
    const promise = createNotebookMutation
      .mutateAsync({ tempId, ...input, onCreated })
      .then((notebook) => {
        serverIdByTempId.current.set(tempId, notebook.id);
        return notebook.id;
      })
      .catch(() => {
        toastWithRetry(t("library.toasts.notebookCreateFailed"), t("library.retry"), () => {
          void createNotebook(input);
        });
        return null;
      });
    pendingCreates.current.set(tempId, promise);
    void promise.finally(() => pendingCreates.current.delete(tempId));
    return { tempId, promise };
  };

  const updateNotebook = async (id: string, input: UpdateNotebookLibraryInput) => {
    if (isTempId(id) && input.title !== undefined) {
      if (pendingCreates.current.has(id)) pendingNames.current.set(id, input.title);
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: current.notebooks.map((notebook) =>
          notebook.id === id ? { ...notebook, title: input.title! } : notebook,
        ),
      }));
    }
    const realId = await resolveId(id);
    pendingNames.current.delete(id);
    if (!realId) return undefined;
    let folderId = input.folderId;
    if (folderId !== undefined && folderId !== null) {
      const realFolderId = await resolveId(folderId);
      if (!realFolderId) return undefined;
      folderId = realFolderId;
    }
    try {
      return await updateNotebookMutation.mutateAsync({
        id: realId,
        ...input,
        ...(folderId !== undefined ? { folderId } : {}),
      });
    } catch {
      toastWithRetry(t("library.toasts.notebookUpdateFailed"), t("library.retry"), () => {
        void updateNotebook(id, input);
      });
      return undefined;
    }
  };

  const deleteNotebook = async (id: string) => {
    if (isTempId(id) && pendingCreates.current.has(id)) {
      patchLibrary(queryClient, (current) => ({
        ...current,
        notebooks: current.notebooks.filter((item) => item.id !== id),
      }));
    }
    const realId = await resolveId(id);
    if (!realId) return false;
    try {
      await deleteNotebookMutation.mutateAsync(realId);
      return true;
    } catch {
      toastWithRetry(t("library.toasts.notebookRemoveFailed"), t("library.retry"), () => {
        void deleteNotebook(id);
      });
      return false;
    }
  };

  return {
    createFolder,
    updateFolder,
    deleteFolder,
    createNotebook,
    updateNotebook,
    deleteNotebook,
  };
}
