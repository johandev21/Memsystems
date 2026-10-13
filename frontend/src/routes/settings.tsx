import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout } from "@/pages/settings";
import { SettingsPageSkeleton } from "@/pages/settings/settings-page-skeleton";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
  pendingComponent: SettingsPageSkeleton,
});
