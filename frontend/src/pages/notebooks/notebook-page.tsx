import { useParams } from "@tanstack/react-router";
import { NotebookHeader } from "@/features/notebooks/components/notebook-header";
import { NotebookWorkspaceContainer } from "@/features/notebooks/components/notebook-workspace/notebook-workspace-container";
import { BreakUiToggle } from "@/features/notebooks/dev-fixtures/break-ui-toggle";

export function NotebookPage({ notebookId: propNotebookId }: { notebookId?: string } = {}) {
  const params = useParams({ strict: false });
  const notebookId = propNotebookId ?? params.notebookId ?? "";
  return (
    <div className="flex h-dvh flex-col">
      <NotebookHeader id={notebookId} />
      <div className="flex-1 mx-0 sm:mx-2 lg:mx-4 my-0 sm:my-2 scrollbar-none overflow-hidden">
        <NotebookWorkspaceContainer notebookId={notebookId} />
      </div>
      {import.meta.env.DEV && <BreakUiToggle />}
    </div>
  );
}
