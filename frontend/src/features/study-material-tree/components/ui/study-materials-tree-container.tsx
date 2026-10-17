import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { foldersQueryOptions } from "../../api/folders";
import { studyMaterialsQueryOptions } from "@/features/study-material-viewer/api";
import { useTreeSearch } from "@/components/ui/tree";
import { StudyMaterialsTree, type StudyMaterialsTreeSize } from "./study-materials-tree";
import { StudyMaterialsTreeSkeleton } from "./study-materials-tree-skeleton";
import { StudyMaterialsTreeError } from "./study-materials-tree-error";
import { usePersistentExpandedFolders } from "../model/use-expanded";
import { useProductionTreeAdapter } from "../model/production-adapter";
import type { TreeCommandExecutor } from "../model/commands";
import { MobileStudyMaterialsView } from "../mobile/mobile-study-materials-view";
import { cn } from "@/shared/utils/cn";

export interface StudyMaterialsTreeContainerProps {
  notebookId: string;
  onMaterialActivate?: (materialId: string) => void;
  onCommand?: TreeCommandExecutor;
  size?: StudyMaterialsTreeSize;
  className?: string;
  variant?: "desktop" | "mobile" | "standalone";
  isPanelExpanded?: boolean;
  onPanelToggle?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
}

function useStudyMaterialsTreeData(notebookId: string) {
  const { t } = useTranslation("tree");
  const foldersQuery = useQuery({
    ...foldersQueryOptions(notebookId),
    enabled: Boolean(notebookId),
  });
  const materialsQuery = useQuery({
    ...studyMaterialsQueryOptions(notebookId),
    enabled: Boolean(notebookId),
  });

  const folders = foldersQuery.data ?? [];
  const materials = materialsQuery.data ?? [];

  const isInitialLoading = foldersQuery.isPending || materialsQuery.isPending;
  const isError = foldersQuery.isError || materialsQuery.isError;
  const errorMessage =
    (foldersQuery.error as Error | undefined)?.message ??
    (materialsQuery.error as Error | undefined)?.message ??
    t("errors.loadFailed");
  const isFetching = foldersQuery.isFetching || materialsQuery.isFetching;
  const hasData = foldersQuery.isSuccess && materialsQuery.isSuccess;

  const handleRetry = useCallback(() => {
    void foldersQuery.refetch();
    void materialsQuery.refetch();
  }, [foldersQuery, materialsQuery]);

  return {
    folders,
    materials,
    isInitialLoading,
    isError,
    errorMessage,
    isFetching,
    hasData,
    handleRetry,
  };
}

interface TreeLoadedContentProps {
  className?: string;
  data: ReturnType<typeof useStudyMaterialsTreeData>;
  onMaterialActivate?: (materialId: string) => void;
  effectiveOnCommand?: TreeCommandExecutor;
  size?: StudyMaterialsTreeSize;
  expandedIds: Set<string>;
  setExpandedIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  isPanelExpanded: boolean;
  onPanelToggle: () => void;
  variant?: StudyMaterialsTreeContainerProps["variant"];
  search: ReturnType<typeof useTreeSearch>;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
}

function TreeLoadedContent({
  className,
  data,
  onMaterialActivate,
  effectiveOnCommand,
  size,
  expandedIds,
  setExpandedIds,
  isPanelExpanded,
  onPanelToggle,
  variant,
  search,
  isSearchOpen,
  onToggleSearch,
}: TreeLoadedContentProps) {
  return (
    <div
      data-slot="study-materials-tree-container"
      className={cn(isPanelExpanded && "h-full flex flex-col min-h-0", className)}
    >
      {data.isFetching && data.hasData && <TreeUpdatingIndicator />}
      <StudyMaterialsTree
        folders={data.folders}
        materials={data.materials}
        onMaterialActivate={onMaterialActivate}
        onCommand={effectiveOnCommand}
        size={size}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        isPanelExpanded={isPanelExpanded}
        onPanelToggle={onPanelToggle}
        contentHeight={variant ?? "standalone"}
        searchQuery={search.searchQuery}
        onSearchChange={search.setSearchQuery}
        matchCount={search.matchCount}
        isItemVisible={search.isItemVisible}
        isFolderVisible={search.isFolderVisible}
        isSearchOpen={isSearchOpen}
        onToggleSearch={onToggleSearch}
      />
      {data.isError && data.hasData && <TreeRefreshError onRetry={data.handleRetry} />}
    </div>
  );
}

export function StudyMaterialsTreeContainer({
  notebookId,
  onMaterialActivate,
  onCommand,
  size = "sm",
  className,
  variant = "standalone",
  isPanelExpanded: controlledIsPanelExpanded,
  onPanelToggle: onControlledPanelToggle,
  isSearchOpen: controlledIsSearchOpen,
  onToggleSearch: onControlledToggleSearch,
}: StudyMaterialsTreeContainerProps) {
  const data = useStudyMaterialsTreeData(notebookId);
  const [expandedIds, setExpandedIds] = usePersistentExpandedFolders(notebookId, data.folders);
  const [internalPanelExpanded, setInternalPanelExpanded] = useState(false);
  const [internalIsSearchOpen, setInternalIsSearchOpen] = useState(false);

  const isPanelExpanded =
    controlledIsPanelExpanded !== undefined
      ? controlledIsPanelExpanded
      : internalPanelExpanded;
  const handlePanelToggle =
    onControlledPanelToggle ?? (() => setInternalPanelExpanded((v) => !v));

  const isSearchOpen =
    controlledIsSearchOpen !== undefined ? controlledIsSearchOpen : internalIsSearchOpen;

  const handleToggleSearch = useCallback(() => {
    if (onControlledToggleSearch) {
      onControlledToggleSearch();
    } else {
      setInternalIsSearchOpen((prev) => !prev);
    }
  }, [onControlledToggleSearch]);

  const search = useTreeSearch({
    items: useMemo(
      () =>
        data.materials.map((m) => ({
          id: m.id,
          name: m.title,
          folderId: m.folderId,
        })),
      [data.materials],
    ),
    folders: useMemo(
      () =>
        data.folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
        })),
      [data.folders],
    ),
  });

  useEffect(() => {
    if (!isSearchOpen && search.searchQuery) {
      search.setSearchQuery("");
    }
  }, [isSearchOpen, search]);

  const effectiveExpandedIds = useMemo(() => {
    if (!search.isSearching) return expandedIds;
    return new Set([...expandedIds, ...search.expandedFolderIds]);
  }, [expandedIds, search.isSearching, search.expandedFolderIds]);

  const productionExecute = useProductionTreeAdapter(notebookId);
  const effectiveOnCommand = onCommand ?? productionExecute;

  if (variant === "mobile") {
    return (
      <div data-slot="study-materials-tree-container" className={className}>
        {data.isFetching && data.hasData && <TreeUpdatingIndicator />}
        <MobileStudyMaterialsView
          notebookId={notebookId}
          folders={data.folders}
          materials={data.materials}
          isPending={data.isInitialLoading && !data.hasData}
          isError={data.isError && !data.hasData}
          errorMessage={data.errorMessage}
          onRetryLoad={data.handleRetry}
          onSelectMaterial={(id) => id && onMaterialActivate?.(id)}
          onCommand={effectiveOnCommand}
        />
        {data.isError && data.hasData && <TreeRefreshError onRetry={data.handleRetry} />}
      </div>
    );
  }

  if (data.isInitialLoading && !data.hasData) {
    return (
      <StudyMaterialsTreeSkeleton
        className={cn(isPanelExpanded && "h-full", className)}
      />
    );
  }

  if (data.isError && !data.hasData) {
    return (
      <StudyMaterialsTreeError
        message={data.errorMessage}
        onRetry={data.handleRetry}
        isRetrying={data.isFetching}
      />
    );
  }

  return (
    <TreeLoadedContent
      className={className}
      data={data}
      onMaterialActivate={onMaterialActivate}
      effectiveOnCommand={effectiveOnCommand}
      size={size}
      expandedIds={effectiveExpandedIds}
      setExpandedIds={setExpandedIds}
      isPanelExpanded={isPanelExpanded}
      onPanelToggle={handlePanelToggle}
      variant={variant}
      search={search}
      isSearchOpen={isSearchOpen}
      onToggleSearch={handleToggleSearch}
    />
  );
}

function TreeUpdatingIndicator() {
  const { t } = useTranslation("tree");
  return (
    <div
      data-slot="study-materials-tree-updating"
      className="h-1 w-full overflow-hidden bg-muted"
      aria-label={t("tree.updating")}
      aria-busy="true"
    >
      <div className="h-full w-1/3 animate-pulse bg-primary/40" />
    </div>
  );
}

function TreeRefreshError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("tree");
  return (
    <div className="p-2 text-xs text-destructive">
      {t("errors.refreshFailed")}{" "}
      <button onClick={onRetry} className="underline">
        {t("errors.retry")}
      </button>
    </div>
  );
}
