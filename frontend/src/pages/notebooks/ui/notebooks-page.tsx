import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, NotebookText, Plus, Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { NotebookIcon } from "@/shared/ui/notebook-icon";
import { NotebookCard } from "@/shared/ui/notebook-card";
import { EmptyState } from "@/shared/ui/empty-state";
import { AppHeader } from "@/shared/ui/layout";
import { Spinner } from "@/shared/ui/spinner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { TypographyH1, TypographyMuted } from "@/shared/ui/typography";
import { allNotebooksQueryOptions } from "@/shared/api";
import { fetchApi } from "@/shared/lib/utils";
import type { Notebook } from "@/entities/notebook";

function getVisiblePages(page: number, totalPages: number): number[] {
  return Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (pageNumber) =>
      pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - page) <= 1,
  );
}

export function NotebooksPage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/notebooks/" });
  const queryClient = useQueryClient();
  const page = searchParams.page || 1;
  const search = searchParams.search || "";
  const [searchInput, setSearchInput] = useState(search);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useQuery(allNotebooksQueryOptions(page, search || undefined));

  const notebooks = data?.notebooks ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 12));

  const visiblePages = getVisiblePages(page, totalPages);

  function handleSearch() {
    navigate({
      to: "/notebooks",
      search: { page: 1, search: searchInput },
    });
  }

  function handlePageSelection(p: number) {
    navigate({
      to: "/notebooks",
      search: { page: p, search },
    });
  }

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
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-360 px-6 pb-12">
        <NotebooksHeader total={total} isCreating={isCreating} onCreate={handleCreateNotebook} />
        <NotebookSearch
          value={searchInput}
          hasSearch={Boolean(search)}
          onChange={setSearchInput}
          onSearch={handleSearch}
          onClear={() => {
            setSearchInput("");
            navigate({ to: "/notebooks", search: { page: 1, search: "" } });
          }}
        />
        <NotebooksContent
          isLoading={isLoading}
          notebooks={notebooks}
          search={search}
          isCreating={isCreating}
          onCreate={handleCreateNotebook}
        />

        {totalPages > 1 && (
          <section className="flex items-center justify-center gap-2 py-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageSelection(page - 1)}
              className="cursor-pointer"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            {visiblePages.map((p, idx) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && visiblePages[idx - 1] !== p - 1 && (
                  <span className="text-muted-foreground px-1">...</span>
                )}
                <Button
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageSelection(p)}
                  className="min-w-9 cursor-pointer"
                >
                  {p}
                </Button>
              </span>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageSelection(page + 1)}
              className="cursor-pointer"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}

function NotebooksHeader({
  total,
  isCreating,
  onCreate,
}: {
  total: number;
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <TypographyH1 className="text-xl font-heading font-bold text-left">
          All Notebooks
        </TypographyH1>
        <TypographyMuted className="mt-1">
          {total} {total === 1 ? "notebook" : "notebooks"} total
        </TypographyMuted>
      </div>
      <Button onClick={onCreate} disabled={isCreating} className="w-full sm:w-auto cursor-pointer">
        {isCreating ? <Spinner className="mr-2" /> : <Plus className="mr-2 size-4" />}New Notebook
      </Button>
    </section>
  );
}

function NotebookSearch({
  value,
  hasSearch,
  onChange,
  onSearch,
  onClear,
}: {
  value: string;
  hasSearch: boolean;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onSearch();
  };
  return (
    <section className="flex items-center gap-2 pb-6">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search notebooks..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-9"
        />
      </div>
      <Button variant="outline" onClick={onSearch} className="cursor-pointer">
        Search
      </Button>
      {hasSearch && (
        <Button variant="ghost" onClick={onClear} className="cursor-pointer">
          Clear
        </Button>
      )}
    </section>
  );
}

function NotebooksContent({
  isLoading,
  notebooks,
  search,
  isCreating,
  onCreate,
}: {
  isLoading: boolean;
  notebooks: Notebook[];
  search: string;
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 py-2">
      {isLoading ? (
        <NotebookLoadingState />
      ) : notebooks.length === 0 ? (
        <NotebookEmptyState search={search} isCreating={isCreating} onCreate={onCreate} />
      ) : (
        <NotebookGrid notebooks={notebooks} />
      )}
    </section>
  );
}

function NotebookLoadingState() {
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

function NotebookEmptyState({
  search,
  isCreating,
  onCreate,
}: {
  search: string;
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <EmptyState
      icon={<NotebookText className="size-7 text-muted-foreground" />}
      title={search ? "No notebooks match your search" : "No notebooks yet"}
      description={
        search
          ? "Try a different search query or adjust your filters."
          : "Your notebooks will live here. Create one to start learning."
      }
    >
      {!search && (
        <Button onClick={onCreate} disabled={isCreating} size="sm" className="cursor-pointer">
          {isCreating ? <Spinner className="mr-2" /> : <Plus className="mr-2 size-4" />}New Notebook
        </Button>
      )}
    </EmptyState>
  );
}

function NotebookGrid({ notebooks }: { notebooks: Notebook[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notebooks.map((notebook) => (
        <NotebookCard
          key={notebook.id}
          id={notebook.id}
          title={notebook.title}
          description={notebook.description}
          updatedAt=""
          imageUrl={notebook.bannerUrl ?? undefined}
          bannerFocalPoint={notebook.bannerFocalPoint}
          icon={<NotebookIcon name={notebook.icon} />}
        />
      ))}
    </div>
  );
}
