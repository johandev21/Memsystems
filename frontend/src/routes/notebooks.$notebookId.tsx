import { createFileRoute } from "@tanstack/react-router";
import { NotebookPage } from "@/pages/notebooks";

export const Route = createFileRoute("/notebooks/$notebookId")({
  component: NotebookPage,
});
