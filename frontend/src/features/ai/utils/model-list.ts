import type { ModelOption } from "../types/model.types";
import { isStudyMaterialCapable } from "./model-capabilities";

export interface ModelListFilters {
  search?: string;
  structuredOnly?: boolean;
  capabilitiesVerified?: boolean;
}

/** Search and capability filters compose; with nothing set the list is intact. */
export function filterModels(models: ModelOption[], filters: ModelListFilters = {}): ModelOption[] {
  const query = filters.search?.trim().toLowerCase() ?? "";
  const structuredOnly = filters.structuredOnly === true;
  const capabilitiesVerified = filters.capabilitiesVerified === true;

  return models.filter((model) => {
    if (structuredOnly && !isStudyMaterialCapable(model, capabilitiesVerified)) return false;
    if (!query) return true;
    return model.displayName.toLowerCase().includes(query) || model.id.toLowerCase().includes(query);
  });
}

export function groupModels(models: ModelOption[]): Record<string, ModelOption[]> {
  return models.reduce<Record<string, ModelOption[]>>((groups, model) => {
    const provider = model.id.split("/")[0] || "openai";
    (groups[provider] ??= []).push(model);
    return groups;
  }, {});
}
