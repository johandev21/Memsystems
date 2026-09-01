import { useMemo } from "react";
import type { ModelOption } from "@/features/ai";

export interface UseWebSearchModelResult {
  isSupported: boolean;
  currentModel: ModelOption | undefined;
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
    currentModel?.supportsWebSearch || currentModel?.capabilities?.webSearch,
  );

  return {
    isSupported,
    currentModel,
  };
}
