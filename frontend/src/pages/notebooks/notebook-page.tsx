import { NotebookHeader, NotebookWorkspaceContainer } from "@/features/notebooks";

export function NotebookPage({ notebookId }: { notebookId: string }) {
  return (
    <div className="flex h-[100dvh] flex-col">
      <NotebookHeader id={notebookId} />
      <div className="flex-1 mx-0 sm:mx-2 lg:mx-4 my-0 sm:my-2 scrollbar-none overflow-hidden">
        <NotebookWorkspaceContainer notebookId={notebookId} />
      </div>
    </div>
  );
}
