import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/home";
// Direct import: the @/pages/home barrel re-exports HomePage (and the whole
// notebook library). The pending component is eager, so it must not pull the
// route's real component graph into the entry bundle.
import { HomePageSkeleton } from "@/pages/home/home-page-skeleton";

export const Route = createFileRoute("/")({
  component: HomePage,
  pendingComponent: HomePageSkeleton,
});
