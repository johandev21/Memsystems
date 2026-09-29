import { useMemo } from "react";
import type { ModelOption } from "../types/model.types";
import { filterModels, groupModels, type ModelListFilters } from "../utils/model-list";

/** Shared search/filter/grouping for every model picker. */
export function useModelList(
  models: ModelOption[],
  filters: ModelListFilters,
): Record<string, ModelOption[]> {
  const { search, structuredOnly, capabilitiesVerified } = filters;
  return useMemo(
    () => groupModels(filterModels(models, { search, structuredOnly, capabilitiesVerified })),
    [models, search, structuredOnly, capabilitiesVerified],
  );
}
