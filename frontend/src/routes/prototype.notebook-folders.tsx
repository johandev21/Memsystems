import { createFileRoute } from "@tanstack/react-router";
import { NotebookFoldersPrototypePage } from "@/pages/home/notebook-folders-prototype-page";

export const Route = createFileRoute("/prototype/notebook-folders")({
  component: NotebookFoldersPrototypePage,
});
