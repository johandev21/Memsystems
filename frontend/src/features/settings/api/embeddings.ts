import i18n from "@/shared/i18n";
import { fetchApi, resolveApiErrorMessage } from "@/shared/api";

export interface VoyageConnection {
  hasKey: boolean;
  model: string;
  dimensions: number;
}

async function toError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    params?: Record<string, string | number>;
  } | null;
  return new Error(
    resolveApiErrorMessage(
      { error: body?.error, params: body?.params },
      i18n.t("embeddings.toast.requestFailed", { ns: "settings" }),
    ),
  );
}

export async function fetchVoyageConnection(): Promise<VoyageConnection | null> {
  const res = await fetchApi("/api/ai/embedding-connection");
  if (!res.ok) return null;
  return res.json();
}

export async function saveVoyageKey(key: string): Promise<VoyageConnection> {
  const res = await fetchApi("/api/ai/embedding-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voyageApiKey: key.trim() }),
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function deleteVoyageKey(): Promise<VoyageConnection> {
  const res = await fetchApi("/api/ai/embedding-connection", { method: "DELETE" });
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function reembedAllSources(): Promise<{ enqueued: number }> {
  const res = await fetchApi("/api/sources/reembed-all", { method: "POST" });
  if (!res.ok) throw await toError(res);
  return res.json();
}
