import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/home";
import { requireAuth } from "@/app/router/guards";

export const Route = createFileRoute("/home")({
  beforeLoad: requireAuth,
  component: HomePage,
});
