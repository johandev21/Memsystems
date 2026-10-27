import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { Announcements } from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { exportNotebook, importNotebook } from "@/features/notebooks";
import { libraryQueryOptions } from "../api/library";
import { useLibraryInteractions } from "./use-library-interactions";
import { useLibraryMutations } from "./use-library-mutations";
import { toLibraryNotebook } from "../model/adapters";
import { folderPath } from "../model/folder-hierarchy";
import type { LibrarySortKey } from "../model/library-sort";
import type { LibrarySearch } from "../model/search-params";
import { clampTitle } from "../model/title";
import type { Draft, LibraryFolder, LibraryNotebook } from "../model/types";

type LibraryDragData = { kind?: string; folderId?: string | null; notebookId?: string };

export function createLibraryAnnouncements(
  folders: LibraryFolder[],
  notebooks: LibraryNotebook[],
  t: TFunction<"notebooks">,
): Announcements {
  const activeName = (dragData: LibraryDragData | undefined) => {
    if (dragData?.kind === "folder") {
      return (
        folders.find((folder) => folder.id === dragData.folderId)?.name ??
        t("library.untitledFolder")
      );
    }
    if (dragData?.kind === "notebook") {
      return (
        notebooks.find((notebook) => notebook.id === dragData.notebookId)?.title ??
        t("library.untitledNotebook")
      );
    }
    return "";
  };
  const targetName = (dropData: LibraryDragData | undefined) => {
    if (!dropData || !("folderId" in dropData)) return null;
    return typeof dropData.folderId === "string"
      ? folderPath(folders, dropData.folderId)
      : t("library.library");
  };

  return {
    onDragStart: ({ active }) =>
      t("library.dnd.dragStart", { name: activeName(active.data.current) }),
    onDragOver: ({ active, over }) => {
      const target = targetName(over?.data.current);
      return target
        ? t("library.dnd.dragOver", { name: activeName(active.data.current), target })
        : t("library.dnd.dragOverNone", { name: activeName(active.data.current) });
    },
    onDragEnd: ({ active, over }) => {
      const target = targetName(over?.data.current);
      return target
        ? t("library.dnd.dragEnd", { name: activeName(active.data.current), target })
        : t("library.dnd.dragEndNone", { name: activeName(active.data.current) });
    },
    onDragCancel: ({ active }) =>
      t("library.dnd.dragCancel", { name: activeName(active.data.current) }),
  };
}

export function useNotebookExport(t: TFunction<"notebooks">) {
  return useCallback(
    async (id: string, title: string) => {
      try {
        toast.loading(t("settings.exporting", "Exporting notebook…"), { id: `export-${id}` });
        await exportNotebook(id, title);
        toast.success(t("settings.exportSuccess", "Notebook exported successfully"), {
          id: `export-${id}`,
        });
      } catch {
        toast.error(t("settings.exportFailed", "Failed to export notebook"), {
          id: `export-${id}`,
        });
      }
    },
    [t],
  );
}

export function useMobileLibraryCreation(
  mutations: ReturnType<typeof useLibraryMutations>,
  activeFolderId: string | null,
  navigate: ReturnType<typeof useNavigate>,
) {
  const handleCreateFolder = useCallback(
    async (name: string) => {
      const { promise } = mutations.createFolder({ name, parentId: activeFolderId });
      await promise;
    },
    [activeFolderId, mutations],
  );

  const handleCreateNotebook = useCallback(
    async (title: string) => {
      const { promise } = mutations.createNotebook({ title, folderId: activeFolderId });
      const serverId = await promise;
      if (serverId) {
        void navigate({ to: "/notebooks/$notebookId", params: { notebookId: serverId } });
      }
    },
    [activeFolderId, mutations, navigate],
  );

  return {
    handleCreateFolderMobile: handleCreateFolder,
    handleCreateNotebookMobile: handleCreateNotebook,
  };
}

export function useNotebookImport(
  activeFolderId: string | null,
  navigate: ReturnType<typeof useNavigate>,
  t: TFunction<"notebooks">,
) {
  const queryClient = useQueryClient();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";

      const toastId = toast.loading(t("library.toasts.importing", "Importing notebook…"));
      try {
        const imported = await importNotebook(file, activeFolderId);
        toast.success(t("library.toasts.importSuccess", "Notebook imported successfully"), {
          id: toastId,
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
          queryClient.invalidateQueries({ queryKey: ["folders"] }),
          queryClient.invalidateQueries({ queryKey: ["library"] }),
        ]);
        void navigate({ to: "/notebooks/$notebookId", params: { notebookId: imported.id } });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : t("library.toasts.importFailed", "Failed to import notebook");
        toast.error(message, { id: toastId });
      }
    },
    [activeFolderId, navigate, queryClient, t],
  );

  return { importInputRef, handleTriggerImport, handleImportFileChange };
}

export function useNotebookLibraryController() {
  const { t } = useTranslation("notebooks");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as LibrarySearch | undefined;
  const rawFolderId = search?.folderId ?? null;
  const sortKey: LibrarySortKey = search?.sort ?? "name";

  const { data, isLoading, isError, refetch, isRefetching } = useQuery(libraryQueryOptions);
  const mutations = useLibraryMutations();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryNotebook | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<LibraryFolder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const folders = useMemo(() => data?.folders ?? [], [data]);
  const notebooks = useMemo(() => (data?.notebooks ?? []).map(toLibraryNotebook), [data]);

  const activeFolderExists = !rawFolderId || folders.some((folder) => folder.id === rawFolderId);
  const activeFolderId = activeFolderExists ? rawFolderId : null;

  useEffect(() => {
    if (isLoading || isError || !data || !rawFolderId) return;
    const exists = folders.some((folder) => folder.id === rawFolderId);
    if (!exists) {
      void navigate({
        to: "/",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          folderId: undefined,
        }),
        replace: true,
      });
    }
  }, [isLoading, isError, data, rawFolderId, folders, navigate]);

  const announcements = useMemo(
    () => createLibraryAnnouncements(folders, notebooks, t),
    [folders, notebooks, t],
  );

  const interaction = useLibraryInteractions({
    folders,
    notebooks,
    onMoveFolder: (folderId, parentId) => {
      void mutations.updateFolder(folderId, { parentId });
    },
    onMoveNotebook: (notebookId, folderId) => {
      void mutations.updateNotebook(notebookId, { folderId });
    },
  });
  const handleExportNotebook = useNotebookExport(t);
  const { handleCreateFolderMobile, handleCreateNotebookMobile } = useMobileLibraryCreation(
    mutations,
    activeFolderId,
    navigate,
  );
  const { importInputRef, handleTriggerImport, handleImportFileChange } = useNotebookImport(
    activeFolderId,
    navigate,
    t,
  );

  const draftKey = draft ? `${draft.kind}:${draft.id}` : null;

  const beginCreateFolder = () => {
    setSelectedKey(null);
    const { tempId, promise } = mutations.createFolder(
      { name: t("library.untitledFolder"), parentId: activeFolderId },
      (createdTempId, serverId) => {
        setDraft((current) =>
          current?.clientId === createdTempId ? { ...current, id: serverId } : current,
        );
      },
    );
    setDraft({ kind: "folder", id: tempId, clientId: tempId });
    void promise.then((serverId) => {
      if (!serverId) {
        setDraft((current) => (current?.clientId === tempId ? null : current));
      }
    });
  };

  const beginCreateNotebook = () => {
    setSelectedKey(null);
    const { tempId, promise } = mutations.createNotebook(
      { title: t("library.untitledNotebook"), folderId: activeFolderId },
      (createdTempId, serverId) => {
        setDraft((current) =>
          current?.clientId === createdTempId ? { ...current, id: serverId } : current,
        );
      },
    );
    setDraft({ kind: "notebook", id: tempId, clientId: tempId });
    void promise.then((serverId) => {
      if (!serverId) {
        setDraft((current) => (current?.clientId === tempId ? null : current));
      }
    });
  };

  const commitDraft = (name: string) => {
    if (!draft) return;
    const fallback =
      draft.kind === "folder" ? t("library.untitledFolder") : t("library.untitledNotebook");
    const nextName = clampTitle(name.trim()) || fallback;
    if (draft.kind === "folder") {
      void mutations.updateFolder(draft.id, { name: nextName });
    } else {
      void mutations.updateNotebook(draft.id, { title: nextName });
    }
    setDraft(null);
  };

  const cancelDraft = () => {
    if (!draft) return;
    if (draft.kind === "folder") {
      void mutations.deleteFolder(draft.id);
    } else {
      void mutations.deleteNotebook(draft.id);
    }
    setDraft(null);
  };

  const openFolder = (id: string | null) => {
    setSelectedKey(null);
    void navigate({
      to: "/",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        folderId: id ?? undefined,
      }),
      replace: false,
    });
  };

  const handleSortChange = (nextSort: LibrarySortKey) => {
    void navigate({
      to: "/",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        sort: nextSort === "name" ? undefined : nextSort,
      }),
      replace: true,
    });
  };

  const requestRemoveFolder = (id: string) => {
    const folder = folders.find((item) => item.id === id);
    if (folder) setPendingFolderDelete(folder);
  };

  const confirmRemoveFolder = async () => {
    if (!pendingFolderDelete) return;
    const { id, parentId } = pendingFolderDelete;
    setIsDeleting(true);
    if (draft?.id === id) setDraft(null);
    setSelectedKey((current) => (current === `folder:${id}` ? null : current));
    if (activeFolderId === id) {
      void navigate({
        to: "/",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          folderId: parentId ?? undefined,
        }),
        replace: true,
      });
    }
    try {
      await mutations.deleteFolder(id);
      setPendingFolderDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const requestRemoveNotebook = (id: string) => {
    const notebook = notebooks.find((item) => item.id === id);
    if (notebook) setPendingDelete(notebook);
  };

  const confirmRemoveNotebook = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setIsDeleting(true);
    if (draft?.id === id) setDraft(null);
    setSelectedKey((current) => (current === `notebook:${id}` ? null : current));
    try {
      await mutations.deleteNotebook(id);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const openNotebook = (id: string) => {
    void navigate({ to: "/notebooks/$notebookId", params: { notebookId: id } });
  };

  return {
    t,
    isLoading,
    isError,
    refetch,
    isRefetching,
    folders,
    notebooks,
    activeFolderId,
    sortKey,
    draft,
    draftKey,
    selectedKey: selectedKey ?? draftKey,
    setSelectedKey,
    pendingDelete,
    setPendingDelete,
    pendingFolderDelete,
    setPendingFolderDelete,
    isDeleting,
    announcements,
    interaction,
    handleExportNotebook,
    handleCreateFolderMobile,
    handleCreateNotebookMobile,
    importInputRef,
    handleTriggerImport,
    handleImportFileChange,
    beginCreateFolder,
    beginCreateNotebook,
    commitDraft,
    cancelDraft,
    openFolder,
    handleSortChange,
    requestRemoveFolder,
    confirmRemoveFolder,
    requestRemoveNotebook,
    confirmRemoveNotebook,
    openNotebook,
    mutations,
  };
}
