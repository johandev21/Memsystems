import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/pages/login";
import { redirectIfAuthenticated } from "@/app/router/guards";

export const Route = createFileRoute("/login")({
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
});
