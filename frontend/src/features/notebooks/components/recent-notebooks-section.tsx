import { formatDistanceToNow } from "date-fns";
import type { TFunction } from "i18next";
import { ArrowUpRight, CloudOff, NotebookText, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getDateLocale } from "@/shared/utils";
import { useRecentNotebooks, type RecentNotebooksPagination } from "../hooks/use-recent-notebooks";
import { NotebookCard } from "./notebook-card";
import { NotebookIcon } from "./notebook-icon";
import type { Notebook } from "../types";

const CARD_ENTRANCE_CLASS =
  "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards motion-reduce:animate-none";

export function RecentNotebooksSection() {
  const { t } = useTranslation("notebooks");
  const {
    notebooks,
    isLoading,
    isError,
    isRetrying,
    onRetryLoad,
    isCreating,
    onCreate,
    pagination,
  } = useRecentNotebooks();

  return (
    <>
      <NotebooksHero onCreate={onCreate} isCreating={isCreating} />
      <section className="flex animate-in flex-col gap-4 py-6 slide-in-from-bottom-2 duration-300 delay-100 fill-mode-backwards motion-reduce:animate-none">
        <RecentNotebooksSectionHeader title={t("recent.title")} />
        <RecentNotebooksContent
          isLoading={isLoading}
          isError={isError}
          isRetrying={isRetrying}
          onRetryLoad={onRetryLoad}
          notebooks={notebooks}
          isCreating={isCreating}
          onCreate={onCreate}
          pagination={pagination}
        />
      </section>
    </>
  );
}

function NotebooksHero({
  onCreate,
  isCreating,
}: {
  onCreate: () => void;
  isCreating: boolean;
}) {
  const { t } = useTranslation("notebooks");

  return (
    <section className="flex animate-in flex-col gap-4 py-6 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-md font-heading text-2xl leading-snug font-semibold tracking-[-0.03em] text-foreground">
          {t("recent.heroTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("recent.heroSubtitle")}</p>
      </div>
      <Button
        onClick={onCreate}
        disabled={isCreating}
        className="w-full sm:w-auto cursor-pointer"
      >
        {isCreating ? <Spinner className="mr-2" /> : <Plus className="mr-2 size-4" />}
        {t("recent.newNotebook")}
      </Button>
    </section>
  );
}

function RecentNotebooksSectionHeader({
  title,
  viewAllHref,
  viewAllLabel,
}: {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  const { t } = useTranslation("notebooks");

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {viewAllHref && (
        <Link
          to={viewAllHref}
          className="inline-flex items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {viewAllLabel ?? t("recent.viewAll")}
          <ArrowUpRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function RecentNotebooksContent({
  isLoading,
  isError,
  isRetrying,
  onRetryLoad,
  notebooks,
  isCreating,
  onCreate,
  pagination,
}: {
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
  onRetryLoad: () => void;
  notebooks: Notebook[];
  isCreating: boolean;
  onCreate: () => void;
  pagination: RecentNotebooksPagination;
}) {
  if (isLoading) return <RecentNotebooksLoading />;
  if (isError) return <RecentNotebooksLoadError isRetrying={isRetrying} onRetry={onRetryLoad} />;
  if (!notebooks.length)
    return <RecentNotebooksEmpty isCreating={isCreating} onCreate={onCreate} />;
  return (
    <div className="flex flex-col gap-4">
      <RecentNotebookGrid notebooks={notebooks} />
      <RecentNotebooksPaginationFooter
        pagination={pagination}
        totalCount={notebooks.length}
      />
    </div>
  );
}

function NotebookSkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden ring-1 ring-foreground/10 rounded-[min(var(--radius-4xl),24px)]">
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
  );
}

function RecentNotebooksLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <NotebookSkeletonCard key={i} />
      ))}
    </div>
  );
}

function RecentNotebooksLoadingMore() {
  const { t } = useTranslation("notebooks");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <NotebookSkeletonCard key={i} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
        <Spinner />
        <span>{t("recent.loadingMore")}</span>
      </div>
    </div>
  );
}

function RecentNotebooksLoadError({
  isRetrying,
  onRetry,
}: {
  isRetrying: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation("notebooks");

  return (
    <EmptyState
      className="animate-in fade-in duration-300 motion-reduce:animate-none"
      icon={<CloudOff className="size-7 text-muted-foreground" />}
      title={t("recent.loadFailedTitle")}
      description={t("recent.loadFailedDescription")}
    >
      <Button onClick={onRetry} disabled={isRetrying} size="sm" className="cursor-pointer">
        {isRetrying ? <Spinner className="mr-2" /> : <RefreshCw className="mr-2 size-4" />}
        {t("recent.retry")}
      </Button>
    </EmptyState>
  );
}

function RecentNotebooksEmpty({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation("notebooks");

  return (
    <EmptyState
      className="animate-in fade-in duration-300 motion-reduce:animate-none"
      icon={<NotebookText className="size-7 text-muted-foreground" />}
      title={t("recent.emptyTitle")}
      description={t("recent.emptyDescription")}
    >
      <Button onClick={onCreate} disabled={isCreating} size="sm" className="cursor-pointer">
        {isCreating ? <Spinner className="mr-2" /> : <Plus className="mr-2 size-4" />}
        {t("recent.newNotebook")}
      </Button>
    </EmptyState>
  );
}

// Stagger only the first rows; below-fold and load-more cards enter immediately.
function cardEntranceDelay(index: number): number {
  return index <= 8 ? index * 50 : 0;
}

function RecentNotebookGrid({ notebooks }: { notebooks: Notebook[] }) {
  const { t, i18n } = useTranslation("notebooks");

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notebooks.map((notebook, index) => (
        <NotebookCard
          key={notebook.id}
          id={notebook.id}
          title={notebook.title}
          description={notebook.description}
          updatedAt={formatUpdatedAt(notebook.updatedAt, t, i18n.resolvedLanguage)}
          imageUrl={notebook.bannerUrl ?? undefined}
          bannerVariants={notebook.bannerVariants}
          bannerFocalPoint={notebook.bannerFocalPoint}
          icon={<NotebookIcon name={notebook.icon} />}
          className={CARD_ENTRANCE_CLASS}
          style={{ animationDelay: `${cardEntranceDelay(index)}ms` }}
        />
      ))}
    </div>
  );
}

function RecentNotebooksPaginationFooter({
  pagination,
  totalCount,
}: {
  pagination: RecentNotebooksPagination;
  totalCount: number;
}) {
  const { t } = useTranslation("notebooks");
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, onRetry, sentinelRef } =
    pagination;

  return (
    <>
      <div ref={sentinelRef} />
      {isFetchingNextPage ? <RecentNotebooksLoadingMore /> : null}
      {!isFetchingNextPage && isFetchNextPageError ? (
        <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
          <span>{t("recent.loadMoreFailed")}</span>
          <Button variant="outline" size="sm" onClick={onRetry} className="cursor-pointer">
            {t("recent.retry")}
          </Button>
        </div>
      ) : null}
      {!hasNextPage && !isFetchNextPageError && totalCount > 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("recent.allSeen", { count: totalCount })}
        </p>
      ) : null}
    </>
  );
}

function formatUpdatedAt(
  date: string,
  t: TFunction<"notebooks">,
  language: string | undefined,
): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return t("recent.updatedJustNow");
  const locale = getDateLocale(language);
  return t("recent.updated", { time: formatDistanceToNow(d, { addSuffix: true, locale }) });
}
