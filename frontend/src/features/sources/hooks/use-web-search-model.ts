import { useMemo, useState } from "react";
import type { ModelOption } from "@/features/ai";

export function useWebSearchModel(
  models: ModelOption[] | undefined,
  persistedModel?: string | null,
) {
  const [chosenModel, setChosenModel] = useState<string | null>(null);
  const capableModels = useMemo(
    () => (models ?? []).filter((model) => model.supportsWebSearch),
    [models],
  );
  const defaultModel = useMemo(() => {
    if (capableModels.some((model) => model.id === persistedModel)) return persistedModel as string;
    return capableModels[0]?.id ?? null;
  }, [capableModels, persistedModel]);
  const activeModel = chosenModel ?? defaultModel;

  return {
    capableModels,
    defaultModel,
    activeModel,
    activeProvider: activeModel?.split("/")[0] || "openai",
    autoSwitched: Boolean(persistedModel && defaultModel && persistedModel !== defaultModel),
    hasCapableModel: capableModels.length > 0,
    setChosenModel,
  };
}
