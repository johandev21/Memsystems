import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout } from "@/pages/settings";
import { requireAuth } from "@/app/router/guards";

export const Route = createFileRoute("/settings")({
  beforeLoad: requireAuth,
  component: SettingsLayout,
});
