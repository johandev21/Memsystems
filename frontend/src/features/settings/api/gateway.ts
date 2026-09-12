import i18n from "@/shared/i18n";
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
  if (!res.ok) {
    throw new Error(i18n.t("gateway.toast.refreshFailed", { ns: "settings" }));
  }
}

export async function saveGatewayKey(key: string): Promise<void> {
  const res = await fetchApi("/api/ai/connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gatewayApiKey: key.trim() }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    if (body && typeof body.error === "string") throw new Error(body.error);
    throw new Error(i18n.t("gateway.toast.saveFailed", { ns: "settings" }));
  }
}

export async function deleteGatewayKey(): Promise<void> {
  const res = await fetchApi("/api/ai/connection", { method: "DELETE" });
  if (!res.ok) {
    throw new Error(i18n.t("gateway.toast.removeFailed", { ns: "settings" }));
  }
}
