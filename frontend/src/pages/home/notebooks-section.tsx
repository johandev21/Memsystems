import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { NotebookText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { NotebookIcon } from "@/features/notebooks";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { notebooksQueryOptions } from "@/features/notebooks";
import { fetchApi } from "@/shared/api";
import { NotebookCard } from "@/features/notebooks";
import { SectionHeader } from "./section-header";
import type { Notebook } from "@/features/notebooks";

export function NotebooksSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: notebooksData, isLoading } = useQuery(notebooksQueryOptions);
  const notebooks = notebooksData?.notebooks;

  async function handleCreateNotebook() {
    try {
      setIsCreating(true);
      const res = await fetchApi("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      if (!res.ok) throw new Error("Failed to create notebook");
      const newNotebook = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      navigate({
        to: "/notebooks/$notebookId",
        params: { notebookId: newNotebook.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create notebook: ${message}`);
      setIsCreating(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="max-w-md font-heading text-2xl leading-snug font-semibold tracking-[-0.03em] text-foreground">
            Make progress on what matters.
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick up where you left off, or start something fresh.
          </p>
        </div>
        <Button
          onClick={handleCreateNotebook}
          disabled={isCreating}
          className="w-full sm:w-auto cursor-pointer"
        >
          {isCreating ? <Spinner className="mr-2" /> : <Plus className="mr-2 size-4" />}
          New notebook
        </Button>
      </section>

      <section className="flex flex-col gap-4 py-6">
        <SectionHeader title="Recent Notebooks" viewAllHref="/notebooks" viewAllLabel="View all" />
        <RecentNotebooksContent
          isLoading={isLoading}
          notebooks={notebooks}
          isCreating={isCreating}
          onCreate={handleCreateNotebook}
        />
      </section>
    </>
  );
}

function RecentNotebooksContent({
  isLoading,
  notebooks,
  isCreating,
  onCreate,
}: {
  isLoading: boolean;
  notebooks?: Notebook[];
  isCreating: boolean;
  onCreate: () => void;
}) {
  if (isLoading) return <RecentNotebooksLoading />;
  if (!notebooks?.length)
    return <RecentNotebooksEmpty isCreating={isCreating} onCreate={onCreate} />;
  return <RecentNotebookGrid notebooks={notebooks} />;
}

function RecentNotebooksLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden ring-1 ring-foreground/10 rounded-[min(var(--radius-4xl),24px)]"
        >
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="flex flex-col gap-1 p-4 pt-8">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full mt-1" />
            <Skeleton className="h-4 w-2/3 mt-0.5" />
          </div>
          <div className="flex items-center justify-between px-4 pb-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentNotebooksEmpty({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <EmptyState
      icon={<NotebookText className="size-7 text-muted-foreground" />}
      title="No notebooks yet"
      description="Your notebooks will live here. Create one to start learning."
    >
      <Button onClick={onCreate} disabled={isCreating} size="sm" className="cursor-pointer">
        {isCreating ? <Spinner className="mr-2" /> : <Plus className="mr-2 size-4" />}New notebook
      </Button>
    </EmptyState>
  );
}

function RecentNotebookGrid({ notebooks }: { notebooks: Notebook[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notebooks.map((notebook) => (
        <NotebookCard
          key={notebook.id}
          id={notebook.id}
          title={notebook.title}
          description={notebook.description}
          updatedAt={formatUpdatedAt(notebook.updatedAt)}
          imageUrl={notebook.bannerUrl ?? undefined}
          bannerFocalPoint={notebook.bannerFocalPoint}
          icon={<NotebookIcon name={notebook.icon} />}
        />
      ))}
    </div>
  );
}

function formatUpdatedAt(date: string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Updated just now";
  return `Updated ${formatDistanceToNow(d, { addSuffix: true })}`;
}
