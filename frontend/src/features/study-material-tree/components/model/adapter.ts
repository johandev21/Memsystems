import { useCallback, useState } from "react";
import i18n from "@/shared/i18n";
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
  const [lastAction, setLastAction] = useState<string>(() =>
    i18n.t("lastAction.ready", { ns: "tree" }),
  );

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
          setLastAction(
            i18n.t("lastAction.created", { ns: "tree", name: folderWithNotebook.name }),
          );
          return { ok: true, newId: id };
        }
        case "renameItem": {
          const previousName =
            getItemName(state, command.id) ?? i18n.t("defaults.item", { ns: "tree" });
          const nextName = command.name.trim();
          if (!nextName || previousName === nextName) {
            return { ok: true };
          }
          setState((prev) => renameItem(prev, command.id, nextName, now));
          setLastAction(
            i18n.t("lastAction.renamed", { ns: "tree", previousName, nextName }),
          );
          return { ok: true };
        }
        case "duplicateMaterial": {
          const name =
            getItemName(state, command.id) ?? i18n.t("defaults.studyMaterial", { ns: "tree" });
          const newId = `material-${crypto.randomUUID()}`;
          const nextState = duplicateMaterial(state, command.id, newId, now);
          if (nextState === state) {
            return { ok: false, error: i18n.t("errors.materialNotFound", { ns: "tree" }) };
          }
          setState(nextState);
          setLastAction(i18n.t("lastAction.duplicated", { ns: "tree", name }));
          return { ok: true, newId };
        }
        case "moveItem": {
          const name = getItemName(state, command.id) ?? i18n.t("defaults.item", { ns: "tree" });
          const targetName =
            command.targetFolderId === null
              ? i18n.t("header.title", { ns: "tree" })
              : (getItemName(state, command.targetFolderId) ??
                i18n.t("defaults.folder", { ns: "tree" }));
          const nextState = moveItem(state, command.id, command.targetFolderId, now);
          if (nextState === state) {
            return { ok: false, error: i18n.t("errors.invalidMove", { ns: "tree" }) };
          }
          setState(nextState);
          setLastAction(i18n.t("lastAction.moved", { ns: "tree", name, targetName }));
          return { ok: true };
        }
        case "deleteItem": {
          const name = getItemName(state, command.id) ?? i18n.t("defaults.item", { ns: "tree" });
          const nextState = softDeleteItem(state, command.id, now);
          setState(nextState);
          setLastAction(i18n.t("lastAction.deleted", { ns: "tree", name }));
          return { ok: true };
        }
        default:
          return { ok: false, error: i18n.t("errors.unknownCommand", { ns: "tree" }) };
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
