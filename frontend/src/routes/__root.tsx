import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { RouterContext } from "@/app/router";
import { RouteProgressBar } from "@/components/feedback";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <RouteProgressBar />
      <Outlet />
    </>
  );
}
