import { createFileRoute } from "@tanstack/react-router";
import { NotebooksPage } from "@/pages/notebooks";
import { requireAuth } from "@/app/router/guards";

export const Route = createFileRoute("/notebooks/")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page) || 1,
    search: (search.search as string) || "",
  }),
  component: NotebooksPage,
});
