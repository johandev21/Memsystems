import { useCallback, useRef, useState } from "react";

import { SAMPLE_FOLDERS, SAMPLE_NOTEBOOKS } from "./sample-data";
import { clampTitle } from "./title";
import type { Folder, Notebook } from "./types";

type PrototypeState = {
  folders: Folder[];
  notebooks: Notebook[];
};

type Snapshot = PrototypeState & { activeFolderId: string | null };
type Draft = { kind: "folder" | "notebook"; id: string };

const PLACEHOLDER_TITLES: Record<Draft["kind"], string> = {
  folder: "Untitled folder",
  notebook: "Untitled notebook",
};

const initialState = (): PrototypeState => ({
  folders: SAMPLE_FOLDERS.map((folder) => ({ ...folder })),
  notebooks: SAMPLE_NOTEBOOKS.map((notebook) => ({ ...notebook })),
});

const cloneSnapshot = (state: PrototypeState, activeFolderId: string | null): Snapshot => ({
  folders: state.folders.map((folder) => ({ ...folder })),
  notebooks: state.notebooks.map((notebook) => ({ ...notebook })),
  activeFolderId,
});

export function useNotebookFoldersPrototype() {
  const [state, setState] = useState<PrototypeState>(initialState);
  const [activeFolderId, setActiveFolderIdState] = useState<string | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftSnapshot = useRef<Snapshot | null>(null);

  const setActiveFolderId = useCallback(
    (folderId: string | null) => {
      if (folderId === null || state.folders.some((folder) => folder.id === folderId)) {
        setActiveFolderIdState(folderId);
      }
    },
    [state.folders],
  );

  const recordChange = useCallback(() => {
    setHistory((previous) => [...previous, cloneSnapshot(state, activeFolderId)]);
  }, [activeFolderId, state]);

  const moveNotebook = useCallback(
    (notebookId: string, folderId: string | null) => {
      const notebook = state.notebooks.find((item) => item.id === notebookId);
      const validTarget =
        folderId === null || state.folders.some((folder) => folder.id === folderId);

      if (!notebook || !validTarget || notebook.folderId === folderId) return;

      recordChange();
      setState((current) => ({
        ...current,
        notebooks: current.notebooks.map((item) =>
          item.id === notebookId ? { ...item, folderId, updatedAt: new Date().toISOString() } : item,
        ),
      }));
    },
    [recordChange, state.folders, state.notebooks],
  );

  const beginCreate = useCallback(
    (kind: Draft["kind"]) => {
      draftSnapshot.current = cloneSnapshot(state, activeFolderId);
      const now = new Date().toISOString();
      const id = `${kind}-${crypto.randomUUID()}`;
      if (kind === "folder") {
        setState((current) => ({
          ...current,
          folders: [...current.folders, { id, name: PLACEHOLDER_TITLES.folder, createdAt: now, updatedAt: now }],
        }));
        setActiveFolderIdState(null);
      } else {
        setState((current) => ({
          ...current,
          notebooks: [
            ...current.notebooks,
            { id, title: PLACEHOLDER_TITLES.notebook, description: "", icon: "Notebook", coverUrl: null, folderId: activeFolderId, createdAt: now, updatedAt: now },
          ],
        }));
      }
      setDraft({ kind, id });
    },
    [activeFolderId, state],
  );

  const commitDraft = useCallback(
    (name: string) => {
      if (!draft) return;
      const nextName = clampTitle(name.trim()) || PLACEHOLDER_TITLES[draft.kind];
      const snapshot = draftSnapshot.current;
      if (snapshot) setHistory((previous) => [...previous, snapshot]);
      draftSnapshot.current = null;
      const now = new Date().toISOString();
      setState((current) =>
        draft.kind === "folder"
          ? {
              ...current,
              folders: current.folders.map((folder) =>
                folder.id === draft.id ? { ...folder, name: nextName, updatedAt: now } : folder,
              ),
            }
          : {
              ...current,
              notebooks: current.notebooks.map((notebook) =>
                notebook.id === draft.id ? { ...notebook, title: nextName, updatedAt: now } : notebook,
              ),
            },
      );
      setDraft(null);
    },
    [draft],
  );

  const cancelDraft = useCallback(() => {
    if (!draft) return;
    draftSnapshot.current = null;
    setState((current) =>
      draft.kind === "folder"
        ? { ...current, folders: current.folders.filter((folder) => folder.id !== draft.id) }
        : { ...current, notebooks: current.notebooks.filter((notebook) => notebook.id !== draft.id) },
    );
    setDraft(null);
  }, [draft]);

  const beginCreateFolder = useCallback(() => beginCreate("folder"), [beginCreate]);
  const beginCreateNotebook = useCallback(() => beginCreate("notebook"), [beginCreate]);

  const renameFolder = useCallback(
    (folderId: string, name: string) => {
      const trimmedName = clampTitle(name.trim());
      const folder = state.folders.find((item) => item.id === folderId);
      if (!trimmedName || !folder || folder.name === trimmedName) return;

      recordChange();
      setState((current) => ({
        ...current,
        folders: current.folders.map((folder) =>
          folder.id === folderId ? { ...folder, name: trimmedName, updatedAt: new Date().toISOString() } : folder,
        ),
      }));
    },
    [recordChange, state.folders],
  );

  const updateNotebook = useCallback(
    (notebookId: string, patch: Partial<Pick<Notebook, "title" | "description">>) => {
      const notebook = state.notebooks.find((item) => item.id === notebookId);
      if (!notebook) return;
      const nextTitle = clampTitle(patch.title?.trim() ?? "") || notebook.title;
      const nextDescription = patch.description ?? notebook.description;
      if (nextTitle === notebook.title && nextDescription === notebook.description) return;
      recordChange();
      setState((current) => ({
        ...current,
        notebooks: current.notebooks.map((item) =>
          item.id === notebookId
            ? { ...item, title: nextTitle, description: nextDescription, updatedAt: new Date().toISOString() }
            : item,
        ),
      }));
    },
    [recordChange, state.notebooks],
  );

  const removeFolder = useCallback(
    (folderId: string) => {
      const folder = state.folders.find((item) => item.id === folderId);
      if (!folder) return;

      recordChange();
      setState((current) => ({
        folders: current.folders.filter((item) => item.id !== folderId),
        notebooks: current.notebooks.map((notebook) =>
          notebook.folderId === folderId ? { ...notebook, folderId: null } : notebook,
        ),
      }));
      if (activeFolderId === folderId) setActiveFolderIdState(null);
    },
    [activeFolderId, recordChange, state.folders],
  );

  const undo = useCallback(() => {
    if (draft) {
      cancelDraft();
      return;
    }
    const previous = history.at(-1);
    if (!previous) return;

    setState({ folders: previous.folders, notebooks: previous.notebooks });
    setActiveFolderIdState(previous.activeFolderId);
    setHistory((current) => current.slice(0, -1));
  }, [cancelDraft, draft, history]);

  return {
    folders: state.folders,
    notebooks: state.notebooks,
    activeFolderId,
    setActiveFolderId,
    moveNotebook,
    beginCreateFolder,
    beginCreateNotebook,
    draft,
    commitDraft,
    cancelDraft,
    renameFolder,
    updateNotebook,
    removeFolder,
    undo,
    canUndo: history.length > 0,
  };
}
