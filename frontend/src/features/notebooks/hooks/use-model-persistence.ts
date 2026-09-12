import { useCallback, useContext, useState } from "react";
import {
  NotebookModelContext,
  getPersistedModel,
  setPersistedModel,
} from "../context/notebook-model-state";

export function useModelPersistence(notebookId: string) {
  const context = useContext(NotebookModelContext);
  const [localModel, setLocalModel] = useState<string>(() => getPersistedModel(notebookId));

  const persistModel = useCallback(
    (id: string) => {
      setPersistedModel(notebookId, id);
      setLocalModel(id);
    },
    [notebookId],
  );

  if (context) {
    return {
      model: context.selectedModel,
      setModel: context.setSelectedModel,
      selectedModel: context.selectedModel,
      setSelectedModel: context.setSelectedModel,
    };
  }

  return {
    model: localModel,
    setModel: persistModel,
    selectedModel: localModel,
    setSelectedModel: persistModel,
  };
}
