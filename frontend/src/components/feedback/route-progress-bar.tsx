import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/shared/auth";

export function RouteProgressBar() {
  const isNavigating = useRouterState({
    select: (state) => state.status === "pending",
  });
  const auth = useAuth();
  const isLoading = isNavigating || auth.status === "loading";

  if (!isLoading) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent pointer-events-none"
    >
      <div className="h-full w-full bg-primary animate-route-progress origin-left shadow-xs" />
    </div>
  );
}
