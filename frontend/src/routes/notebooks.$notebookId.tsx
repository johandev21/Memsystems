import { createFileRoute } from "@tanstack/react-router";
import { NotebookPage } from "@/pages/notebooks";
import { NotebookPageSkeleton } from "@/pages/notebooks/notebook-page-skeleton";

export const Route = createFileRoute("/notebooks/$notebookId")({
  component: NotebookPage,
  pendingComponent: NotebookPageSkeleton,
});
