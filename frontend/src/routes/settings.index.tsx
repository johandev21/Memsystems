import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/pages/settings";
import { SettingsPageSkeleton } from "@/pages/settings/settings-page-skeleton";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
  pendingComponent: SettingsPageSkeleton,
});
