import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/home";
import { HomePageSkeleton } from "@/pages/home/home-page-skeleton";
import { parseLibrarySearch, type LibrarySearch } from "@/features/notebook-library/model/search-params";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => parseLibrarySearch(search),
  component: HomePage,
  pendingComponent: HomePageSkeleton,
});
