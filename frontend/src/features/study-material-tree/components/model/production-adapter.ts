import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FolderDTO } from "../../types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";
import {
  getCommandPendingKey,
  type CommandResult,
  type TreeCommand,
  type TreeCommandExecutor,
} from "./commands";
import {
  type AdapterContext,
  executeCreateFolder,
  executeDeleteItem,
  executeDuplicateMaterial,
  executeMoveItem,
  executeRenameItem,
} from "./production-adapter-actions";

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

      const ctx: AdapterContext = {
        queryClient,
        notebookId,
        refetchTree,
        isFolder,
        isMaterial,
        getFolderCache,
        getMaterialCache,
      };

      try {
        switch (command.type) {
          case "createFolder":
            return await executeCreateFolder(ctx, command.parentId);
          case "renameItem":
            return await executeRenameItem(ctx, command.id, command.name);
          case "deleteItem":
            return await executeDeleteItem(ctx, command.id);
          case "duplicateMaterial":
            return await executeDuplicateMaterial(ctx, command.id);
          case "moveItem":
            return await executeMoveItem(ctx, command.id, command.targetFolderId);
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
