import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { foldersQueryOptions } from "../../api/folders";
import { studyMaterialsQueryOptions } from "@/features/study-material-viewer/api";
import { StudyMaterialsTree, type StudyMaterialsTreeSize } from "./study-materials-tree";
import { StudyMaterialsTreeSkeleton } from "./study-materials-tree-skeleton";
import { StudyMaterialsTreeError } from "./study-materials-tree-error";
import { usePersistentExpandedFolders } from "../model/use-expanded";
import { useProductionTreeAdapter } from "../model/production-adapter";
import type { TreeCommandExecutor } from "../model/commands";

export interface StudyMaterialsTreeContainerProps {
  notebookId: string;
  onMaterialActivate?: (materialId: string) => void;
  onCommand?: TreeCommandExecutor;
  size?: StudyMaterialsTreeSize;
  className?: string;
  variant?: "desktop" | "mobile" | "standalone";
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
}: TreeLoadedContentProps) {
  const contentHeight = getTreeContentHeight(variant);

  return (
    <div data-slot="study-materials-tree-container" className={className}>
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
        contentClassName={contentHeight}
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
}: StudyMaterialsTreeContainerProps) {
  const data = useStudyMaterialsTreeData(notebookId);
  const [expandedIds, setExpandedIds] = usePersistentExpandedFolders(notebookId, data.folders);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const productionExecute = useProductionTreeAdapter(notebookId);
  const effectiveOnCommand = onCommand ?? productionExecute;

  if (data.isInitialLoading && !data.hasData) {
    return <StudyMaterialsTreeSkeleton className={className} />;
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
      expandedIds={expandedIds}
      setExpandedIds={setExpandedIds}
      isPanelExpanded={isPanelExpanded}
      onPanelToggle={() => setIsPanelExpanded((v) => !v)}
      variant={variant}
    />
  );
}

function getTreeContentHeight(variant: StudyMaterialsTreeContainerProps["variant"]): string {
  const heights = {
    desktop: "h-[250px]",
    mobile: "max-h-[38dvh] min-h-[240px] h-auto overflow-y-auto overscroll-contain",
    standalone: "h-[400px]",
  } as const;
  return heights[variant ?? "standalone"];
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
