import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout } from "@/pages/settings";
// Direct import: the @/pages/settings barrel re-exports the settings sections.
// The pending component is eager, so it must not pull that graph along.
import { SettingsPageSkeleton } from "@/pages/settings/settings-page-skeleton";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
  pendingComponent: SettingsPageSkeleton,
});
