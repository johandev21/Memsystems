import { createRouter } from "@tanstack/react-router";
import { RouteLoadingFallback } from "../../components/feedback/route-loading-fallback";
import { routeTree } from "../../routeTree.gen";

export interface RouterContext {
  // biome-ignore lint/complexity/noBannedTypes: router context kept for future use
  [key: string]: unknown;
}

export const router = createRouter({
  routeTree,
  context: {},
  defaultPendingComponent: RouteLoadingFallback,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
