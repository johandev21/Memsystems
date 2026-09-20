import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Source } from "../../api/sources";
import { SourceRow } from "./source-row";
import { cn } from "@/shared/utils/cn";

export interface SourcesListProps {
  sources?: Source[];
  isPending: boolean;
  isError: boolean;
  hasNoSources: boolean;
  scrollElement?: HTMLDivElement | null;
  onSelectSource: (id: string) => void;
  onDelete: (source: Source) => void;
  onRetry: (source: Source) => void;
  onCancel: (source: Source) => void;
  deletingId?: string;
  retryingId?: string;
  cancellingId?: string;
}

export function SourcesList({
  sources,
  isPending,
  isError,
  hasNoSources,
  scrollElement,
  onSelectSource,
  onDelete,
  onRetry,
  onCancel,
  deletingId,
  retryingId,
  cancellingId,
}: SourcesListProps) {
  const { t } = useTranslation("sources");
  const isVirtualized = (sources?.length ?? 0) > 25 && scrollElement !== undefined;

  // TanStack Virtual returns functions that React Compiler cannot memoize; the
  // compiler already skips this component, which is the intended behavior.
  // eslint-disable-next-line react/incompatible-library -- third-party virtualizer API
  const virtualizer = useVirtualizer({
    count: sources?.length ?? 0,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => 40,
    overscan: 5,
    getItemKey: (idx) => sources?.[idx]?.id ?? idx,
    enabled: isVirtualized,
    initialRect: { width: 800, height: 600 },
  });

  if (isPending)
    return <Loader2 className="mx-auto my-10 size-4 animate-spin text-muted-foreground" />;

  if (isError) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>{t("sourcesList.failedToLoad")}</span>
      </div>
    );
  }

  if (hasNoSources) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{t("sourcesList.emptyTitle")}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t("sourcesList.emptyDescription")}
        </p>
      </div>
    );
  }

  if (isVirtualized && sources) {
    return (
      <div
        className={cn("w-full relative min-w-full", "h-(--virtual-total)")}
        style={{ "--virtual-total": `${virtualizer.getTotalSize()}px` } as React.CSSProperties}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const source = sources[virtualRow.index];
          if (!source) return null;

          return (
            <div
              key={source.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full translate-y-(--virtual-start)"
              style={{ "--virtual-start": `${virtualRow.start}px` } as React.CSSProperties}
            >
              <SourceRow
                source={source}
                onClick={() => onSelectSource(source.id)}
                onDelete={() => onDelete(source)}
                onRetry={() => onRetry(source)}
                onCancel={() => onCancel(source)}
                deleting={deletingId === source.id}
                retrying={retryingId === source.id}
                cancelling={cancellingId === source.id}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return sources?.map((source) => (
    <SourceRow
      key={source.id}
      source={source}
      onClick={() => onSelectSource(source.id)}
      onDelete={() => onDelete(source)}
      onRetry={() => onRetry(source)}
      onCancel={() => onCancel(source)}
      deleting={deletingId === source.id}
      retrying={retryingId === source.id}
      cancelling={cancellingId === source.id}
    />
  ));
}
