import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getPersistedModel,
  NotebookModelContext,
  resolveModelId,
  setPersistedModel,
  type NotebookModelContextValue,
} from "./notebook-model-state";

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
    return resolveModelId(initialModel ?? getPersistedModel(notebookId));
  });

  useEffect(() => {
    setSelectedModelState(resolveModelId(initialModel ?? getPersistedModel(notebookId)));
  }, [notebookId, initialModel]);

  const setSelectedModel = useCallback(
    (id: string) => {
      setPersistedModel(notebookId, id);
      setSelectedModelState(id);
    },
    [notebookId],
  );

  const value: NotebookModelContextValue = useMemo(
    () => ({
      selectedModel,
      setSelectedModel,
      model: selectedModel,
      setModel: setSelectedModel,
    }),
    [selectedModel, setSelectedModel],
  );

  return <NotebookModelContext.Provider value={value}>{children}</NotebookModelContext.Provider>;
}
