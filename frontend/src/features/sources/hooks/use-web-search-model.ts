import { useMemo } from "react";
import type { ModelOption } from "@/features/ai";

export interface UseWebSearchModelResult {
  isSupported: boolean;
  currentModel: ModelOption | undefined;
}

function supportsWebSearch(model: ModelOption): boolean {
  return model.supportsWebSearch === true || model.capabilities?.webSearch === true;
}

export function useWebSearchModel(
  models: ModelOption[] | undefined,
  selectedModel?: string | null,
): UseWebSearchModelResult {
  const currentModel = useMemo(
    () => (models ?? []).find((model) => model.id === selectedModel),
    [models, selectedModel],
  );

  const isSupported = Boolean(
    currentModel && supportsWebSearch(currentModel),
  );

  return {
    isSupported,
    currentModel,
  };
}
