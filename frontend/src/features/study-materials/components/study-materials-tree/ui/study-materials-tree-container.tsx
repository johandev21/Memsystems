import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { foldersQueryOptions, studyMaterialsQueryOptions } from "@/shared/api";
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

export function StudyMaterialsTreeContainer({
  notebookId,
  onMaterialActivate,
  onCommand,
  size = "sm",
  className,
  variant = "standalone",
}: StudyMaterialsTreeContainerProps) {
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

  const [expandedIds, setExpandedIds] = usePersistentExpandedFolders(notebookId, folders);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const productionExecute = useProductionTreeAdapter(notebookId);
  const effectiveOnCommand = onCommand ?? productionExecute;

  const isInitialLoading = foldersQuery.isPending || materialsQuery.isPending;
  const isError = foldersQuery.isError || materialsQuery.isError;
  const errorMessage =
    (foldersQuery.error as Error | undefined)?.message ??
    (materialsQuery.error as Error | undefined)?.message ??
    "Failed to load study materials";
  const isFetching = foldersQuery.isFetching || materialsQuery.isFetching;
  const hasData = foldersQuery.isSuccess && materialsQuery.isSuccess;

  const handleRetry = useCallback(() => {
    void foldersQuery.refetch();
    void materialsQuery.refetch();
  }, [foldersQuery, materialsQuery]);

  if (isInitialLoading && !hasData) {
    return <StudyMaterialsTreeSkeleton className={className} />;
  }

  if (isError && !hasData) {
    return (
      <StudyMaterialsTreeError
        message={errorMessage}
        onRetry={handleRetry}
        isRetrying={isFetching}
      />
    );
  }

  // hasData: render tree, retain last good during background refetch
  const contentHeight =
    variant === "desktop"
      ? "h-[250px]"
      : variant === "mobile"
        ? "max-h-[38dvh] min-h-[240px] h-auto overflow-y-auto overscroll-contain"
        : "h-[400px]";

  return (
    <div data-slot="study-materials-tree-container" className={className}>
      {isFetching && hasData && (
        <div
          data-slot="study-materials-tree-updating"
          className="h-1 w-full overflow-hidden bg-muted"
          aria-label="Updating study materials"
          aria-busy="true"
        >
          <div className="h-full w-1/3 animate-pulse bg-primary/40" />
        </div>
      )}
      <StudyMaterialsTree
        folders={folders}
        materials={materials}
        onMaterialActivate={onMaterialActivate}
        onCommand={effectiveOnCommand}
        size={size}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        isPanelExpanded={isPanelExpanded}
        onPanelToggle={() => setIsPanelExpanded((v) => !v)}
        contentClassName={contentHeight}
      />
      {isError && hasData && (
        <div className="p-2 text-xs text-destructive">
          Failed to refresh. <button onClick={handleRetry} className="underline">Retry</button>
        </div>
      )}
    </div>
  );
}
