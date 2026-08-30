import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/auth";
import { getApiUrl } from "@/shared/api";

export interface ProviderStatus {
  ok: boolean;
  detail?: string;
  models: Array<{ id: string; displayName: string }>;
  hasKey: boolean;
  checkedAt: string | null;
}

export interface ConnectionStatus {
  ok: boolean;
  detail?: string;
  models: Array<{ id: string; displayName: string }>;
  checkedAt: string | null;
  providers: Record<string, ProviderStatus>;
  opencode: ProviderStatus;
  openai: ProviderStatus;
}

async function fetchConnection(): Promise<ConnectionStatus> {
  const res = await fetch(getApiUrl("/api/ai/connection"), {
    credentials: "include",
  });
  if (!res.ok) {
    return {
      ok: false,
      detail: "Failed to check connection",
      models: [],
      checkedAt: null,
      providers: {},
      opencode: {
        ok: false,
        detail: "Failed to check connection",
        models: [],
        hasKey: false,
        checkedAt: null,
      },
      openai: {
        ok: false,
        detail: "Failed to check connection",
        models: [],
        hasKey: false,
        checkedAt: null,
      },
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

