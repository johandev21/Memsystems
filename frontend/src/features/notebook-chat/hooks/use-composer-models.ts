import { useMemo } from "react";
import type { ModelOption } from "@/features/ai";
import { useModelList } from "@/features/ai";

export { getProviderName, PROVIDER_NAMES } from "@/features/ai";

export function normalizeModels(models: ModelOption[] | unknown): ModelOption[] {
  if (Array.isArray(models)) return models;
  if (models && typeof models === "object" && "models" in models && Array.isArray(models.models))
    return models.models as ModelOption[];
  return [];
}

export interface UseComposerModelsResult {
  activeModel: ModelOption | undefined;
  activeProvider: string;
  groups: Record<string, ModelOption[]>;
  supportsImages: boolean;
}

export interface ComposerModelFilters {
  capabilitiesVerified?: boolean;
  structuredOnly?: boolean;
}

export function useComposerModels(
  models: ModelOption[] | unknown,
  selectedModel: string,
  search: string,
  filters: ComposerModelFilters = {},
): UseComposerModelsResult {
  const safeModels = useMemo(() => normalizeModels(models), [models]);
  const groups = useModelList(safeModels, {
    search,
    structuredOnly: filters.structuredOnly === true,
    capabilitiesVerified: filters.capabilitiesVerified === true,
  });
  const activeModel = safeModels.find((model) => model.id === selectedModel);
  const supportsImages = activeModel?.capabilities?.imageInput === true;
  return {
    activeModel,
    activeProvider: selectedModel.split("/")[0] || "openai",
    groups,
    supportsImages,
  };
}
