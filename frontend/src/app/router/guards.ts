import { redirect } from "@tanstack/react-router";
import type { RouterContext } from "./router";

export function requireAuth({
  context,
  location,
}: {
  context: RouterContext;
  location: { href: string };
}) {
  if (context.auth.status === "signed-out") {
    throw redirect({
      to: "/login",
      search: {
        redirect: location.href,
      },
    });
  }
}

export function redirectIfAuthenticated({ context }: { context: RouterContext }) {
  if (context.auth.status === "signed-in") {
    throw redirect({
      to: "/home",
    });
  }
}

