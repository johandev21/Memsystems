import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createFolder, updateFolder } from "@/shared/api";
import {
  duplicateStudyMaterial,
  moveStudyMaterial,
  updateStudyMaterial,
} from "@/shared/api";
import { getDescendantFolderIds } from "./tree";
import type { FolderDTO } from "@/entities/folder";
import type { StudyMaterialDTO } from "@/entities/study-material";
import {
  getCommandPendingKey,
  type CommandResult,
  type TreeCommand,
  type TreeCommandExecutor,
} from "./commands";

export function useProductionTreeAdapter(notebookId: string): TreeCommandExecutor {
  const queryClient = useQueryClient();
  const pendingByKey = useRef<Map<string, boolean>>(new Map());

  const getFolderCache = useCallback((): FolderDTO[] | undefined => {
    return queryClient.getQueryData<FolderDTO[]>(["study-material-folders", notebookId]);
  }, [notebookId, queryClient]);

  const getMaterialCache = useCallback((): StudyMaterialDTO[] | undefined => {
    return queryClient.getQueryData<StudyMaterialDTO[]>(["study-materials", notebookId]);
  }, [notebookId, queryClient]);

  const isFolder = useCallback(
    (id: string): boolean => {
      const folders = getFolderCache();
      return Boolean(folders?.some((f) => f.id === id));
    },
    [getFolderCache],
  );

  const isMaterial = useCallback(
    (id: string): boolean => {
      const materials = getMaterialCache();
      return Boolean(materials?.some((m) => m.id === id));
    },
    [getMaterialCache],
  );

  const refetchTree = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["study-material-folders", notebookId] }),
      queryClient.invalidateQueries({ queryKey: ["study-materials", notebookId] }),
    ]);
  }, [notebookId, queryClient]);

  const execute: TreeCommandExecutor = useCallback(
    async (command: TreeCommand): Promise<CommandResult> => {
      const key = getCommandPendingKey(command);
      if (pendingByKey.current.has(key)) {
        return { ok: false, error: "Command already pending" };
      }
      pendingByKey.current.set(key, true);

      try {
        switch (command.type) {
          case "createFolder": {
            const result = await createFolder(notebookId, {
              name: "Untitled folder",
              parentId: command.parentId ?? undefined,
            });
            // Update cache with returned folder
            queryClient.setQueryData<FolderDTO[]>(["study-material-folders", notebookId], (old) => {
              const list = old ?? [];
              return [...list, result];
            });
            // Refetch on settlement
            void refetchTree();
            return { ok: true, newId: result.id };
          }
          case "renameItem": {
            const trimmed = command.name.trim();
            if (!trimmed) return { ok: false, error: "Name cannot be empty" };

            // Determine if folder or material
            const folderExists = isFolder(command.id);
            const materialExists = isMaterial(command.id);

            if (folderExists) {
              // Optimistic update
              const snapshot = getFolderCache();
              queryClient.setQueryData<FolderDTO[]>(
                ["study-material-folders", notebookId],
                (old) => {
                  if (!old) return old;
                  return old.map((f) => (f.id === command.id ? { ...f, name: trimmed } : f));
                },
              );

              try {
                const updated = await updateFolder(command.id, { name: trimmed });
                // Reconcile with server response
                queryClient.setQueryData<FolderDTO[]>(
                  ["study-material-folders", notebookId],
                  (old) => {
                    if (!old) return [updated];
                    return old.map((f) => (f.id === command.id ? updated : f));
                  },
                );
                void refetchTree();
                return { ok: true };
              } catch (err) {
                // Rollback
                if (snapshot)
                  queryClient.setQueryData(["study-material-folders", notebookId], snapshot);
                const message = err instanceof Error ? err.message : "Failed to rename folder";
                toast.error(message);
                return { ok: false, error: message };
              }
            } else if (materialExists) {
              const snapshot = getMaterialCache();
              queryClient.setQueryData<StudyMaterialDTO[]>(
                ["study-materials", notebookId],
                (old) => {
                  if (!old) return old;
                  return old.map((m) => (m.id === command.id ? { ...m, title: trimmed } : m));
                },
              );

              try {
                const updated = await updateStudyMaterial(command.id, { title: trimmed });
                queryClient.setQueryData<StudyMaterialDTO[]>(
                  ["study-materials", notebookId],
                  (old) => {
                    if (!old) return [updated];
                    return old.map((m) => (m.id === command.id ? updated : m));
                  },
                );
                void refetchTree();
                return { ok: true };
              } catch (err) {
                if (snapshot) queryClient.setQueryData(["study-materials", notebookId], snapshot);
                const message = err instanceof Error ? err.message : "Failed to rename material";
                toast.error(message);
                return { ok: false, error: message };
              }
            } else {
              // Unknown id — try folder first, then material? But we already checked caches, so id not in cache.
              // Fallback: try folder update, if fails try material
              try {
                const updated = await updateFolder(command.id, { name: trimmed });
                queryClient.setQueryData<FolderDTO[]>(
                  ["study-material-folders", notebookId],
                  (old) => {
                    if (!old) return [updated];
                    // If folder not in cache, add it? But should be in cache if it exists
                    const exists = old.some((f) => f.id === command.id);
                    return exists
                      ? old.map((f) => (f.id === command.id ? updated : f))
                      : [...old, updated];
                  },
                );
                void refetchTree();
                return { ok: true };
              } catch {
                try {
                  const updated = await updateStudyMaterial(command.id, { title: trimmed });
                  queryClient.setQueryData<StudyMaterialDTO[]>(
                    ["study-materials", notebookId],
                    (old) => {
                      if (!old) return [updated];
                      const exists = old.some((m) => m.id === command.id);
                      return exists
                        ? old.map((m) => (m.id === command.id ? updated : m))
                        : [...old, updated];
                    },
                  );
                  void refetchTree();
                  return { ok: true };
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Failed to rename";
                  toast.error(message);
                  return { ok: false, error: message };
                }
              }
            }
          }
          case "deleteItem": {
            // Determine if folder or material
            const folderExists = isFolder(command.id);
            const materialExists = isMaterial(command.id);
            // Optimistic: snapshot
            const folderSnapshot = getFolderCache();
            const materialSnapshot = getMaterialCache();

            if (folderExists) {
              // Optimistically remove folder and empty descendant subtree
              const currentFolders = getFolderCache() ?? [];
              const descendantSet = getDescendantFolderIds(currentFolders, command.id);
              descendantSet.add(command.id);
              queryClient.setQueryData<FolderDTO[]>(
                ["study-material-folders", notebookId],
                (old) => {
                  if (!old) return old;
                  return old.filter((f) => !descendantSet.has(f.id));
                },
              );
              try {
                const { deleteFolder } = await import("@/shared/api");
                await deleteFolder(command.id);
                void refetchTree();
                return { ok: true };
              } catch (err) {
                if (folderSnapshot)
                  queryClient.setQueryData(["study-material-folders", notebookId], folderSnapshot);
                if (materialSnapshot)
                  queryClient.setQueryData(["study-materials", notebookId], materialSnapshot);
                const message = err instanceof Error ? err.message : "Failed to delete folder";
                toast.error(message);
                return { ok: false, error: message };
              }
            } else if (materialExists) {
              queryClient.setQueryData<StudyMaterialDTO[]>(
                ["study-materials", notebookId],
                (old) => {
                  if (!old) return old;
                  return old.filter((m) => m.id !== command.id);
                },
              );
              try {
                const { deleteStudyMaterial } = await import("@/shared/api");
                await deleteStudyMaterial(command.id);
                void refetchTree();
                return { ok: true };
              } catch (err) {
                if (materialSnapshot)
                  queryClient.setQueryData(["study-materials", notebookId], materialSnapshot);
                const message = err instanceof Error ? err.message : "Failed to delete material";
                toast.error(message);
                return { ok: false, error: message };
              }
            } else {
              // Unknown — try both
              try {
                const { deleteFolder } = await import("@/shared/api");
                await deleteFolder(command.id);
                void refetchTree();
                return { ok: true };
              } catch {
                try {
                  const { deleteStudyMaterial } = await import("@/shared/api");
                  await deleteStudyMaterial(command.id);
                  void refetchTree();
                  return { ok: true };
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Failed to delete";
                  toast.error(message);
                  return { ok: false, error: message };
                }
              }
            }
          }
          case "duplicateMaterial": {
            try {
              const result = await duplicateStudyMaterial(command.id);
              queryClient.setQueryData<StudyMaterialDTO[]>(
                ["study-materials", notebookId],
                (old) => {
                  const list = old ?? [];
                  if (list.some((m) => m.id === result.id)) return list;
                  return [...list, result];
                },
              );
              void refetchTree();
              return { ok: true, newId: result.id };
            } catch (err) {
              const message = err instanceof Error ? err.message : "Failed to duplicate material";
              toast.error(message);
              return { ok: false, error: message };
            }
          }
          case "moveItem": {
            const targetFolderId = command.targetFolderId;
            const folderExists = isFolder(command.id);
            const materialExists = isMaterial(command.id);
            const folderSnapshot = getFolderCache();
            const materialSnapshot = getMaterialCache();

            if (folderExists) {
              queryClient.setQueryData<FolderDTO[]>(
                ["study-material-folders", notebookId],
                (old) => {
                  if (!old) return old;
                  return old.map((f) =>
                    f.id === command.id ? { ...f, parentId: targetFolderId } : f,
                  );
                },
              );
            } else if (materialExists) {
              queryClient.setQueryData<StudyMaterialDTO[]>(
                ["study-materials", notebookId],
                (old) => {
                  if (!old) return old;
                  return old.map((m) =>
                    m.id === command.id ? { ...m, folderId: targetFolderId } : m,
                  );
                },
              );
            }

            try {
              if (folderExists) {
                const updated = await updateFolder(command.id, { parentId: targetFolderId });
                queryClient.setQueryData<FolderDTO[]>(
                  ["study-material-folders", notebookId],
                  (old) => {
                    if (!old) return [updated];
                    const exists = old.some((f) => f.id === command.id);
                    return exists
                      ? old.map((f) => (f.id === command.id ? updated : f))
                      : [...old, updated];
                  },
                );
                void refetchTree();
                return { ok: true };
              } else if (materialExists) {
                const updated = await moveStudyMaterial(command.id, targetFolderId);
                queryClient.setQueryData<StudyMaterialDTO[]>(
                  ["study-materials", notebookId],
                  (old) => {
                    if (!old) return [updated];
                    const exists = old.some((m) => m.id === command.id);
                    return exists
                      ? old.map((m) => (m.id === command.id ? updated : m))
                      : [...old, updated];
                  },
                );
                void refetchTree();
                return { ok: true };
              } else {
                // Unknown id — try folder then material
                try {
                  const updated = await updateFolder(command.id, { parentId: targetFolderId });
                  queryClient.setQueryData<FolderDTO[]>(
                    ["study-material-folders", notebookId],
                    (old) => {
                      if (!old) return [updated];
                      const exists = old.some((f) => f.id === command.id);
                      return exists
                        ? old.map((f) => (f.id === command.id ? updated : f))
                        : [...old, updated];
                    },
                  );
                  void refetchTree();
                  return { ok: true };
                } catch {
                  const updated = await moveStudyMaterial(command.id, targetFolderId);
                  queryClient.setQueryData<StudyMaterialDTO[]>(
                    ["study-materials", notebookId],
                    (old) => {
                      if (!old) return [updated];
                      const exists = old.some((m) => m.id === command.id);
                      return exists
                        ? old.map((m) => (m.id === command.id ? updated : m))
                        : [...old, updated];
                    },
                  );
                  void refetchTree();
                  return { ok: true };
                }
              }
            } catch (err) {
              if (folderSnapshot)
                queryClient.setQueryData(["study-material-folders", notebookId], folderSnapshot);
              if (materialSnapshot)
                queryClient.setQueryData(["study-materials", notebookId], materialSnapshot);
              const message = err instanceof Error ? err.message : "Failed to move item";
              toast.error(message);
              return { ok: false, error: message };
            }
          }
          default:
            return { ok: false, error: "Unknown command" };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Command failed";
        toast.error(message);
        return { ok: false, error: message };
      } finally {
        pendingByKey.current.delete(key);
      }
    },
    [notebookId, queryClient, getFolderCache, getMaterialCache, isFolder, isMaterial, refetchTree],
  );

  return execute;
}
