import { createFileRoute, notFound } from "@tanstack/react-router";
import { NotebookFoldersPrototypePage } from "@/pages/home/notebook-folders-prototype-page";

export const Route = createFileRoute("/prototype/notebook-folders")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: NotebookFoldersPrototypePage,
});
