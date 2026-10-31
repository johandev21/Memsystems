import { useInfiniteQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { fetchSourcesPage, sourcePageQueryKey, type Source } from "@/features/sources";
import { cn } from "@/shared/utils/cn";

export interface SourceMultiSelectProps {
  notebookId: string;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function SourceMultiSelect({
  notebookId,
  value,
  onChange,
  className,
}: SourceMultiSelectProps) {
  const { t } = useTranslation(["notebooks", "sources"]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const sourcesQuery = useInfiniteQuery({
    queryKey: sourcePageQueryKey(notebookId, deferredSearch),
    queryFn: ({ pageParam, signal }) =>
      fetchSourcesPage(notebookId, { cursor: pageParam, query: deferredSearch, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(notebookId),
  });
  const sources = sourcesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const valueSet = useMemo(() => new Set(value), [value]);

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      if (value.includes(id)) return;
      onChange([...value, id]);
    } else {
      onChange(value.filter((v) => v !== id));
    }
  };

  if (sourcesQuery.isPending && sources.length === 0) {
    return <div className={cn("px-3 py-4 text-center text-xs text-text-faint", className)}>{t("sources:sourcesList.loadingMore")}</div>;
  }

  if (sourcesQuery.isError && sources.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 px-3 py-4 text-center text-xs text-text-faint", className)}>
        <p>{t("sources:sourcesList.failedToLoad")}</p>
        <button type="button" onClick={() => void sourcesQuery.refetch()} className="min-h-10 px-3 font-medium text-primary">
          {t("sources:sourcesList.retry")}
        </button>
      </div>
    );
  }

  if (sources.length === 0 && !search) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-surface-border-subtle bg-surface-2 px-3 py-4 text-center text-xs text-text-faint",
          className,
        )}
      >
        {t("sources.noSources")}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-surface-border-subtle bg-surface-2 max-h-50 overflow-y-auto overflow-x-hidden p-1",
        className,
      )}
    >
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("sources:sourcesList.searchPlaceholder")}
        aria-label={t("sources:sourcesList.searchPlaceholder")}
        className="h-10 w-full rounded-xl bg-background px-3 text-sm outline-none placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-ring"
      />
      {sources.length === 0 && search && (
        <p className="px-2 py-3 text-center text-xs text-text-faint">{t("sources:sourcesList.noMatches")}</p>
      )}
      {sources.map((source) => (
        <SourceRow
          key={source.id}
          source={source}
          checked={valueSet.has(source.id)}
          onToggle={(checked) => toggle(source.id, checked)}
        />
      ))}
      {sourcesQuery.hasNextPage && (
        <button
          type="button"
          onClick={() => void sourcesQuery.fetchNextPage()}
          disabled={sourcesQuery.isFetchingNextPage}
          className="min-h-10 w-full rounded-xl px-2 text-xs font-medium text-primary disabled:opacity-60"
        >
          {sourcesQuery.isFetchNextPageError
            ? t("sources:sourcesList.retry")
            : sourcesQuery.isFetchingNextPage
            ? t("sources:sourcesList.loadingMore")
            : t("sources:sourcesList.loadMore")}
        </button>
      )}
    </div>
  );
}

function SourceRow({
  source,
  checked,
  onToggle,
}: {
  source: Source;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const id = `source-${source.id}`;
  return (
    <Label
      htmlFor={id}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface-3 cursor-pointer text-sm text-text-tertiary"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onToggle(c === true)}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate">{source.title}</span>
      <span className="shrink-0 text-xs uppercase tracking-wide text-text-faint">
        {source.kind}
      </span>
    </Label>
  );
}
