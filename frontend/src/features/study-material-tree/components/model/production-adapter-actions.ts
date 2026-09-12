import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/shared/i18n";
import { createFolder, updateFolder, deleteFolder } from "../../api/folders";
// API module import: the viewer barrel pulls every material view + the AI SDK
// chain, which must stay lazy.
import {
  duplicateStudyMaterial,
  moveStudyMaterial,
  updateStudyMaterial,
} from "@/features/study-material-viewer/api";
import { getDescendantFolderIds } from "./tree";
import type { FolderDTO } from "../../types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer/types";
import type { CommandResult } from "./commands";

export interface AdapterContext {
  queryClient: QueryClient;
  notebookId: string;
  refetchTree: () => Promise<void>;
  isFolder: (id: string) => boolean;
  isMaterial: (id: string) => boolean;
  getFolderCache: () => FolderDTO[] | undefined;
  getMaterialCache: () => StudyMaterialDTO[] | undefined;
}

export async function executeCreateFolder(
  ctx: AdapterContext,
  parentId: string | null | undefined,
): Promise<CommandResult> {
  const result = await createFolder(ctx.notebookId, {
    name: i18n.t("defaults.untitledFolder", { ns: "tree" }),
    parentId: parentId ?? undefined,
  });
  ctx.queryClient.setQueryData<FolderDTO[]>(
    ["study-material-folders", ctx.notebookId],
    (old) => {
      const list = old ?? [];
      return [...list, result];
    },
  );
  void ctx.refetchTree();
  return { ok: true, newId: result.id };
}

export async function executeRenameItem(
  ctx: AdapterContext,
  id: string,
  name: string,
): Promise<CommandResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: i18n.t("errors.nameEmpty", { ns: "tree" }) };

  const folderExists = ctx.isFolder(id);
  const materialExists = ctx.isMaterial(id);

  if (folderExists) {
    const snapshot = ctx.getFolderCache();
    ctx.queryClient.setQueryData<FolderDTO[]>(
      ["study-material-folders", ctx.notebookId],
      (old) => {
        if (!old) return old;
        return old.map((f) => (f.id === id ? { ...f, name: trimmed } : f));
      },
    );

    try {
      const updated = await updateFolder(id, { name: trimmed });
      ctx.queryClient.setQueryData<FolderDTO[]>(
        ["study-material-folders", ctx.notebookId],
        (old) => {
          if (!old) return [updated];
          return old.map((f) => (f.id === id ? updated : f));
        },
      );
      void ctx.refetchTree();
      return { ok: true };
    } catch (err) {
      if (snapshot) {
        ctx.queryClient.setQueryData(["study-material-folders", ctx.notebookId], snapshot);
      }
      const message =
        err instanceof Error ? err.message : i18n.t("errors.renameFolderFailed", { ns: "tree" });
      toast.error(message);
      return { ok: false, error: message };
    }
  } else if (materialExists) {
    const snapshot = ctx.getMaterialCache();
    ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
      ["study-materials", ctx.notebookId],
      (old) => {
        if (!old) return old;
        return old.map((m) => (m.id === id ? { ...m, title: trimmed } : m));
      },
    );

    try {
      const updated = await updateStudyMaterial(id, { title: trimmed });
      ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
        ["study-materials", ctx.notebookId],
        (old) => {
          if (!old) return [updated];
          return old.map((m) => (m.id === id ? updated : m));
        },
      );
      void ctx.refetchTree();
      return { ok: true };
    } catch (err) {
      if (snapshot) {
        ctx.queryClient.setQueryData(["study-materials", ctx.notebookId], snapshot);
      }
      const message =
        err instanceof Error ? err.message : i18n.t("errors.renameMaterialFailed", { ns: "tree" });
      toast.error(message);
      return { ok: false, error: message };
    }
  } else {
    try {
      const updated = await updateFolder(id, { name: trimmed });
      ctx.queryClient.setQueryData<FolderDTO[]>(
        ["study-material-folders", ctx.notebookId],
        (old) => {
          if (!old) return [updated];
          const exists = old.some((f) => f.id === id);
          return exists ? old.map((f) => (f.id === id ? updated : f)) : [...old, updated];
        },
      );
      void ctx.refetchTree();
      return { ok: true };
    } catch {
      try {
        const updated = await updateStudyMaterial(id, { title: trimmed });
        ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
          ["study-materials", ctx.notebookId],
          (old) => {
            if (!old) return [updated];
            const exists = old.some((m) => m.id === id);
            return exists ? old.map((m) => (m.id === id ? updated : m)) : [...old, updated];
          },
        );
        void ctx.refetchTree();
        return { ok: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : i18n.t("errors.renameFailed", { ns: "tree" });
        toast.error(message);
        return { ok: false, error: message };
      }
    }
  }
}

export async function executeDeleteItem(
  ctx: AdapterContext,
  id: string,
): Promise<CommandResult> {
  const folderExists = ctx.isFolder(id);
  const materialExists = ctx.isMaterial(id);
  const folderSnapshot = ctx.getFolderCache();
  const materialSnapshot = ctx.getMaterialCache();

  if (folderExists) {
    const currentFolders = ctx.getFolderCache() ?? [];
    const descendantSet = getDescendantFolderIds(currentFolders, id);
    descendantSet.add(id);
    ctx.queryClient.setQueryData<FolderDTO[]>(
      ["study-material-folders", ctx.notebookId],
      (old) => {
        if (!old) return old;
        return old.filter((f) => !descendantSet.has(f.id));
      },
    );
    try {
      await deleteFolder(id);
      void ctx.refetchTree();
      return { ok: true };
    } catch (err) {
      if (folderSnapshot) {
        ctx.queryClient.setQueryData(["study-material-folders", ctx.notebookId], folderSnapshot);
      }
      if (materialSnapshot) {
        ctx.queryClient.setQueryData(["study-materials", ctx.notebookId], materialSnapshot);
      }
      const message =
        err instanceof Error ? err.message : i18n.t("errors.deleteFolderFailed", { ns: "tree" });
      toast.error(message);
      return { ok: false, error: message };
    }
  } else if (materialExists) {
    ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
      ["study-materials", ctx.notebookId],
      (old) => {
        if (!old) return old;
        return old.filter((m) => m.id !== id);
      },
    );
    try {
      const { deleteStudyMaterial } = await import("@/features/study-material-viewer/api");
      await deleteStudyMaterial(id);
      void ctx.refetchTree();
      return { ok: true };
    } catch (err) {
      if (materialSnapshot) {
        ctx.queryClient.setQueryData(["study-materials", ctx.notebookId], materialSnapshot);
      }
      const message =
        err instanceof Error ? err.message : i18n.t("errors.deleteMaterialFailed", { ns: "tree" });
      toast.error(message);
      return { ok: false, error: message };
    }
  } else {
    try {
      await deleteFolder(id);
      void ctx.refetchTree();
      return { ok: true };
    } catch {
      try {
        const { deleteStudyMaterial } = await import("@/features/study-material-viewer/api");
        await deleteStudyMaterial(id);
        void ctx.refetchTree();
        return { ok: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : i18n.t("errors.deleteFailed", { ns: "tree" });
        toast.error(message);
        return { ok: false, error: message };
      }
    }
  }
}

export async function executeDuplicateMaterial(
  ctx: AdapterContext,
  id: string,
): Promise<CommandResult> {
  try {
    const result = await duplicateStudyMaterial(id);
    ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
      ["study-materials", ctx.notebookId],
      (old) => {
        const list = old ?? [];
        if (list.some((m) => m.id === result.id)) return list;
        return [...list, result];
      },
    );
    void ctx.refetchTree();
    return { ok: true, newId: result.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : i18n.t("errors.duplicateFailed", { ns: "tree" });
    toast.error(message);
    return { ok: false, error: message };
  }
}

export async function executeMoveItem(
  ctx: AdapterContext,
  id: string,
  targetFolderId: string | null,
): Promise<CommandResult> {
  const folderExists = ctx.isFolder(id);
  const materialExists = ctx.isMaterial(id);
  const folderSnapshot = ctx.getFolderCache();
  const materialSnapshot = ctx.getMaterialCache();

  if (folderExists) {
    ctx.queryClient.setQueryData<FolderDTO[]>(
      ["study-material-folders", ctx.notebookId],
      (old) => {
        if (!old) return old;
        return old.map((f) =>
          f.id === id ? { ...f, parentId: targetFolderId } : f,
        );
      },
    );
  } else if (materialExists) {
    ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
      ["study-materials", ctx.notebookId],
      (old) => {
        if (!old) return old;
        return old.map((m) =>
          m.id === id ? { ...m, folderId: targetFolderId } : m,
        );
      },
    );
  }

  try {
    if (folderExists) {
      const updated = await updateFolder(id, { parentId: targetFolderId });
      ctx.queryClient.setQueryData<FolderDTO[]>(
        ["study-material-folders", ctx.notebookId],
        (old) => {
          if (!old) return [updated];
          const exists = old.some((f) => f.id === id);
          return exists ? old.map((f) => (f.id === id ? updated : f)) : [...old, updated];
        },
      );
      void ctx.refetchTree();
      return { ok: true };
    } else if (materialExists) {
      const updated = await moveStudyMaterial(id, targetFolderId);
      ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
        ["study-materials", ctx.notebookId],
        (old) => {
          if (!old) return [updated];
          const exists = old.some((m) => m.id === id);
          return exists ? old.map((m) => (m.id === id ? updated : m)) : [...old, updated];
        },
      );
      void ctx.refetchTree();
      return { ok: true };
    } else {
      try {
        const updated = await updateFolder(id, { parentId: targetFolderId });
        ctx.queryClient.setQueryData<FolderDTO[]>(
          ["study-material-folders", ctx.notebookId],
          (old) => {
            if (!old) return [updated];
            const exists = old.some((f) => f.id === id);
            return exists ? old.map((f) => (f.id === id ? updated : f)) : [...old, updated];
          },
        );
        void ctx.refetchTree();
        return { ok: true };
      } catch {
        const updated = await moveStudyMaterial(id, targetFolderId);
        ctx.queryClient.setQueryData<StudyMaterialDTO[]>(
          ["study-materials", ctx.notebookId],
          (old) => {
            if (!old) return [updated];
            const exists = old.some((m) => m.id === id);
            return exists ? old.map((m) => (m.id === id ? updated : m)) : [...old, updated];
          },
        );
        void ctx.refetchTree();
        return { ok: true };
      }
    }
  } catch (err) {
    if (folderSnapshot) {
      ctx.queryClient.setQueryData(["study-material-folders", ctx.notebookId], folderSnapshot);
    }
    if (materialSnapshot) {
      ctx.queryClient.setQueryData(["study-materials", ctx.notebookId], materialSnapshot);
    }
    const message =
      err instanceof Error ? err.message : i18n.t("errors.moveFailed", { ns: "tree" });
    toast.error(message);
    return { ok: false, error: message };
  }
}
