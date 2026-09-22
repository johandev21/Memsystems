import { createFileRoute } from "@tanstack/react-router";
import { NotebookPage } from "@/pages/notebooks";
// Direct import: the @/pages/notebooks barrel re-exports the whole notebook
// workspace. The pending component is eager, so it must stay out of that graph.
import { NotebookPageSkeleton } from "@/pages/notebooks/notebook-page-skeleton";

export const Route = createFileRoute("/notebooks/$notebookId")({
  component: NotebookPage,
  pendingComponent: NotebookPageSkeleton,
});
