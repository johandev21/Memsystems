import { queryOptions } from "@tanstack/react-query";
import { fetchApi } from "@/shared/api";
import type { ModelOption, ModelsResponse } from "../types/model.types";

export type { ModelOption, ModelsResponse };

export const modelsQueryOptions = queryOptions({
  queryKey: ["models"],
  queryFn: async (): Promise<ModelOption[]> => {
    const res = await fetchApi("/api/ai/models");
    if (!res.ok) throw new Error(`Failed to fetch models (${res.status})`);
    const data = (await res.json()) as ModelsResponse | ModelOption[];
    if (Array.isArray(data)) return data;
    if (
      data &&
      typeof data === "object" &&
      "models" in data &&
      Array.isArray((data as ModelsResponse).models)
    ) {
      return (data as ModelsResponse).models;
    }
    return [];
  },
  staleTime: 30_000,
});
