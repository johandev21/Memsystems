import { createFileRoute } from "@tanstack/react-router";
import { NotebookHeader } from "@/features/notebooks";
import { NotebookWorkspaceContainer } from "@/features/notebooks/components/notebook-workspace";
import { requireAuth } from "@/app/router/guards";

export const Route = createFileRoute("/notebooks/$notebookId")({
  beforeLoad: requireAuth,
  component: NotebookPageComponent,
});

function NotebookPageComponent() {
  const { notebookId } = Route.useParams();

  return (
    <div className="flex h-[100dvh] flex-col">
      <NotebookHeader id={notebookId} />
      <div className="flex-1 mx-0 sm:mx-2 lg:mx-4 my-0 sm:my-2 scrollbar-none overflow-hidden">
        <NotebookWorkspaceContainer notebookId={notebookId} />
      </div>
    </div>
  );
}
