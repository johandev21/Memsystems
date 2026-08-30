import { createRouter } from "@tanstack/react-router";
import { routeTree } from "../../routeTree.gen";
import type { AuthState } from "@/shared/auth";

export interface RouterContext {
  auth: AuthState;
}

export const router = createRouter({
  routeTree,
  context: {
    auth: {
      status: "loading",
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

