import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchApi } from "@/shared/api";
import type { ModelOption, ModelsResponse } from "../types/model.types";

export type { ModelOption, ModelsResponse };

export interface ModelsCatalog {
  models: ModelOption[];
  capabilitiesVerified: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toModelsCatalog(data: unknown): ModelsCatalog {
  if (Array.isArray(data)) {
    return { models: data as ModelOption[], capabilitiesVerified: false };
  }
  if (isRecord(data) && Array.isArray(data.models)) {
    return {
      models: data.models as ModelOption[],
      capabilitiesVerified: data.capabilitiesVerified === true,
    };
  }
  return { models: [], capabilitiesVerified: false };
}

export const modelsQueryOptions = queryOptions({
  queryKey: ["models"],
  queryFn: async (): Promise<ModelsCatalog> => {
    const res = await fetchApi("/api/ai/models");
    if (!res.ok) throw new Error(`Failed to fetch models (${res.status})`);
    return toModelsCatalog(await res.json());
  },
  staleTime: 30_000,
});

export interface ModelsCatalogQuery {
  models: ModelOption[];
  capabilitiesVerified: boolean;
}

export function useModelsCatalog(): ModelsCatalogQuery {
  const { data } = useQuery(modelsQueryOptions);
  const models = useMemo(() => data?.models ?? [], [data]);
  return { models, capabilitiesVerified: data?.capabilitiesVerified === true };
}
