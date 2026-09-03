import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/auth";
import { getApiUrl } from "@/shared/api";

export interface GatewayKeyStatus {
  hasKey: boolean;
  checkedAt: string | null;
}

export interface ConnectionStatus {
  ok: boolean;
  detail?: string;
  degraded: boolean;
  degradedDetail?: string;
  models: Array<{ id: string; displayName: string }>;
  checkedAt: string | null;
  gateway: GatewayKeyStatus;
}

/**
 * The AI backend is usable when healthy OR degraded. Degraded means auth is
 * fine but the gateway is flaky (rate limit, entitlement gap, outage) —
 * requests should still go through and fail per-request with an explainer,
 * instead of locking the UI behind key prompts.
 */
export function isConnectionUsable(
  status: Pick<ConnectionStatus, "ok" | "degraded"> | null | undefined,
): boolean {
  if (!status) return true;
  return status.ok || status.degraded === true;
}

async function fetchConnection(): Promise<ConnectionStatus> {
  const res = await fetch(getApiUrl("/api/ai/connection"), {
    credentials: "include",
  });
  if (!res.ok) {
    return {
      ok: false,
      detail: "Failed to check connection",
      degraded: false,
      models: [],
      checkedAt: null,
      gateway: { hasKey: false, checkedAt: null },
    };
  }
  return res.json();
}

export function useConnectionStatus() {
  const auth = useAuth();
  const userId = auth.status === "signed-in" ? auth.userId : undefined;

  return useQuery({
    queryKey: ["connection-status", userId],
    queryFn: fetchConnection,
    refetchInterval: 15_000,
    retry: 1,
    enabled: auth.status === "signed-in",
  });
}
