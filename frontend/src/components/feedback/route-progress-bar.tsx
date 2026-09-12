import { useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function RouteProgressBar() {
  const { t } = useTranslation();
  const isNavigating = useRouterState({
    select: (state) => state.status === "pending",
  });

  if (!isNavigating) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label={t("routeProgress.loading")}
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent pointer-events-none"
    >
      <div className="h-full w-full bg-primary animate-route-progress origin-left shadow-xs" />
    </div>
  );
}
