import { useRouterState } from "@tanstack/react-router";

export function RouteProgressBar() {
  const isNavigating = useRouterState({
    select: (state) => state.status === "pending",
  });

  if (!isNavigating) {
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
