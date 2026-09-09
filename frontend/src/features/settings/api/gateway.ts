import { fetchApi } from "@/shared/api";

export interface GatewayCredits {
  balance: string;
  totalUsed: string;
}

export async function fetchGatewayCredits(): Promise<GatewayCredits | null> {
  const res = await fetchApi("/api/ai/credits");
  if (!res.ok) return null;
  return res.json();
}

export async function refreshGatewayModels(): Promise<void> {
  const res = await fetchApi("/api/ai/models/refresh", { method: "POST" });
  if (!res.ok) throw new Error("Could not refresh the model list");
}

export async function saveGatewayKey(key: string): Promise<void> {
  const res = await fetchApi("/api/ai/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gatewayApiKey: key.trim() }),
  });
  if (!res.ok) {
    try {
      const body = (await res.json()) as { error?: unknown };
      if (body && typeof body.error === "string") throw new Error(body.error);
    } catch (e) {
      if (e instanceof Error) throw e;
    }
    throw new Error("Could not save this key");
  }
}

export async function deleteGatewayKey(): Promise<void> {
  const res = await fetchApi("/api/ai/connection", { method: "DELETE" });
  if (!res.ok) throw new Error("Could not remove this key");
}
