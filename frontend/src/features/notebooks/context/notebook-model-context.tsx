import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "memsystems-selected-model";
export const DEFAULT_MODEL_ID = "openai/gpt-5.6-sol";

export function getPersistedModel(notebookId: string): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  return (
    localStorage.getItem(`${STORAGE_KEY}-${notebookId}`) ??
    localStorage.getItem("memsystems:selected-model") ??
    DEFAULT_MODEL_ID
  );
}

export function setPersistedModel(notebookId: string, modelId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}-${notebookId}`, modelId);
  localStorage.setItem("memsystems:selected-model", modelId);
}

export interface NotebookModelContextValue {
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  model: string;
  setModel: (modelId: string) => void;
}

export const NotebookModelContext = createContext<NotebookModelContextValue | null>(null);

export interface NotebookModelProviderProps {
  notebookId: string;
  initialModel?: string;
  children: ReactNode;
}

export function NotebookModelProvider({
  notebookId,
  initialModel,
  children,
}: NotebookModelProviderProps) {
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    return initialModel ?? getPersistedModel(notebookId);
  });

  useEffect(() => {
    setSelectedModelState(initialModel ?? getPersistedModel(notebookId));
  }, [notebookId, initialModel]);

  const setSelectedModel = useCallback(
    (id: string) => {
      setPersistedModel(notebookId, id);
      setSelectedModelState(id);
    },
    [notebookId],
  );

  const value: NotebookModelContextValue = {
    selectedModel,
    setSelectedModel,
    model: selectedModel,
    setModel: setSelectedModel,
  };

  return (
    <NotebookModelContext.Provider value={value}>
      {children}
    </NotebookModelContext.Provider>
  );
}

export function useNotebookModel(): NotebookModelContextValue {
  const context = useContext(NotebookModelContext);
  if (!context) {
    throw new Error("useNotebookModel must be used within a NotebookModelProvider");
  }
  return context;
}
