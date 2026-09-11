import { queryOptions } from "@tanstack/react-query";
import {
  createApiErrorMessage,
  resolveApiErrorMessage,
  type ApiErrorResponse,
} from "./api-error";

export function getApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  const options: RequestInit = { credentials: "include", ...init };
  return fetch(getApiUrl(path), options);
}

export function createQueryOptions<TData>(
  queryKey: readonly unknown[],
  url: string,
  options?: {
    staleTime?: number;
    refetchOnMount?: boolean | "always";
    enabled?: boolean;
  },
) {
  return queryOptions({
    queryKey,
    queryFn: async () => {
      const res = await fetchApi(url);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
        throw new Error(resolveApiErrorMessage(data, createApiErrorMessage(res)));
      }
      return res.json() as Promise<TData>;
    },
    staleTime: options?.staleTime ?? 30_000,
    refetchOnMount: options?.refetchOnMount,
    enabled: options?.enabled,
  });
}

export async function apiPost<TInput, TResponse>(url: string, input: TInput): Promise<TResponse> {
  const res = await fetchApi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
  if (!res.ok) {
    throw new Error(resolveApiErrorMessage(data, createApiErrorMessage(res)));
  }
  return data as TResponse;
}

export async function apiPatch<TInput, TResponse>(url: string, input: TInput): Promise<TResponse> {
  const res = await fetchApi(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
  if (!res.ok) {
    throw new Error(resolveApiErrorMessage(data, createApiErrorMessage(res)));
  }
  return data as TResponse;
}

export async function apiDelete(url: string): Promise<void> {
  const res = await fetchApi(url, { method: "DELETE" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorResponse;
    throw new Error(resolveApiErrorMessage(data, createApiErrorMessage(res)));
  }
}
