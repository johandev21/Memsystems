import { useCallback, useState } from "react";
import {
  createFolder,
  duplicateMaterial,
  getItemName,
  moveItem,
  renameItem,
  softDeleteItem,
  type TreeState,
} from "./tree";
import type { CommandResult, TreeCommand, TreeCommandExecutor } from "./commands";

export type LocalTreeAdapter = {
  readonly folders: TreeState["folders"];
  readonly materials: TreeState["materials"];
  readonly lastAction: string;
  readonly execute: TreeCommandExecutor;
  readonly state: TreeState;
  readonly setState: (state: TreeState) => void;
};

export function useLocalTreeAdapter(initialState: TreeState): LocalTreeAdapter {
  const [state, setState] = useState<TreeState>(initialState);
  const [lastAction, setLastAction] = useState("Ready to move study materials in memory.");

  const execute: TreeCommandExecutor = useCallback(
    async (command: TreeCommand): Promise<CommandResult> => {
      const now = new Date().toISOString();

      switch (command.type) {
        case "createFolder": {
          const id = `folder-${crypto.randomUUID()}`;
          const folder = createFolder(command.parentId, id, now);
          // Preserve notebookId from initial state's first folder if available
          const notebookId = state.folders[0]?.notebookId ?? "notebook-placeholder";
          const folderWithNotebook = { ...folder, notebookId };
          setState((prev) => ({ ...prev, folders: [...prev.folders, folderWithNotebook] }));
          setLastAction(`Created ${folderWithNotebook.name}.`);
          return { ok: true, newId: id };
        }
        case "renameItem": {
          const previousName = getItemName(state, command.id) ?? "Item";
          const nextName = command.name.trim();
          if (!nextName || previousName === nextName) {
            return { ok: true };
          }
          setState((prev) => renameItem(prev, command.id, nextName, now));
          setLastAction(`Renamed ${previousName} to ${nextName}.`);
          return { ok: true };
        }
        case "duplicateMaterial": {
          const name = getItemName(state, command.id) ?? "Study material";
          const newId = `material-${crypto.randomUUID()}`;
          const nextState = duplicateMaterial(state, command.id, newId, now);
          if (nextState === state) {
            return { ok: false, error: "Material not found" };
          }
          setState(nextState);
          setLastAction(`Duplicated ${name}.`);
          return { ok: true, newId };
        }
        case "moveItem": {
          const name = getItemName(state, command.id) ?? "Item";
          const targetName =
            command.targetFolderId === null
              ? "Study Materials"
              : (getItemName(state, command.targetFolderId) ?? "folder");
          const nextState = moveItem(state, command.id, command.targetFolderId, now);
          if (nextState === state) {
            return { ok: false, error: "Invalid move" };
          }
          setState(nextState);
          setLastAction(`Moved ${name} to ${targetName}.`);
          return { ok: true };
        }
        case "deleteItem": {
          const name = getItemName(state, command.id) ?? "Item";
          const nextState = softDeleteItem(state, command.id, now);
          setState(nextState);
          setLastAction(`Deleted ${name} from the local prototype.`);
          return { ok: true };
        }
        default:
          return { ok: false, error: "Unknown command" };
      }
    },
    [state],
  );

  return {
    folders: state.folders,
    materials: state.materials,
    lastAction,
    execute,
    state,
    setState,
  };
}
