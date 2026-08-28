import { useEffect, type ReactNode } from "react";
import { authClient } from "@/features/auth";
import { router } from "@/app/router/router";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: sessionData, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) {
      router.invalidate();
    }
  }, [sessionData, isPending]);

  return <>{children}</>;
}
