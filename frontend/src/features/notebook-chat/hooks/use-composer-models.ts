import { useMemo } from "react";
import type { ModelOption } from "@/features/ai";

export const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  opencode: "OpenCode",
  google: "Google",
  gemini: "Gemini",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  kimi: "Kimi",
};

export function getProviderName(provider: string): string {
  return PROVIDER_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function normalizeModels(models: ModelOption[] | unknown): ModelOption[] {
  if (Array.isArray(models)) return models;
  if (models && typeof models === "object" && "models" in models && Array.isArray(models.models))
    return models.models as ModelOption[];
  return [];
}

export function filterModels(models: ModelOption[], search: string): ModelOption[] {
  const query = search.trim().toLowerCase();
  return query
    ? models.filter(
        (model) =>
          model.displayName.toLowerCase().includes(query) || model.id.toLowerCase().includes(query),
      )
    : models;
}

export function groupModels(models: ModelOption[]): Record<string, ModelOption[]> {
  return models.reduce<Record<string, ModelOption[]>>((groups, model) => {
    const provider = model.id.split("/")[0] || "openai";
    (groups[provider] ??= []).push(model);
    return groups;
  }, {});
}

export interface UseComposerModelsResult {
  activeModel: ModelOption | undefined;
  activeProvider: string;
  groups: Record<string, ModelOption[]>;
  supportsImages: boolean;
}

export function useComposerModels(
  models: ModelOption[] | unknown,
  selectedModel: string,
  search: string,
): UseComposerModelsResult {
  const safeModels = useMemo(() => normalizeModels(models), [models]);
  const groups = useMemo(() => groupModels(filterModels(safeModels, search)), [safeModels, search]);
  const activeModel = safeModels.find((model) => model.id === selectedModel);
  const supportsImages = activeModel?.capabilities?.imageInput === true;
  return {
    activeModel,
    activeProvider: selectedModel.split("/")[0] || "openai",
    groups,
    supportsImages,
  };
}
