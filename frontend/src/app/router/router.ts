import { createRouter } from "@tanstack/react-router";
import { routeTree } from "../../routeTree.gen";
import type { AuthContext } from "@/features/auth";

export interface RouterContext {
  auth: AuthContext;
}

export const router = createRouter({
  routeTree,
  context: {
    auth: {
      session: null,
      user: null,
      isPending: true,
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
