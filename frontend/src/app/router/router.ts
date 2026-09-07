import { createRouter } from "@tanstack/react-router";
import { routeTree } from "../../routeTree.gen";

export interface RouterContext {
  // biome-ignore lint/complexity/noBannedTypes: router context kept for future use
  [key: string]: unknown;
}

export const router = createRouter({
  routeTree,
  context: {},
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
