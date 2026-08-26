import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronsUpDown, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ConfirmDeleteDialog } from "@/shared/ui/confirm-delete-dialog";
import { Card, CardContent } from "@/shared/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { EmptyState } from "@/shared/ui/empty-state";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import type { FolderDTO } from "@/entities/folder";
import type { StudyMaterialDTO } from "@/entities/study-material";
import type { TreeCommandExecutor } from "../model/commands";
import { getItemName, type TreeState } from "../model/tree";
import {
  findTreeNode,
  getTreeDragData,
  getTreeDropData,
  TreeControllerProvider,
  useStudyMaterialsTreeController,
} from "./controller";
import { Branch } from "./tree/branch";
import { DragPreview } from "./tree/drag-preview";
import { TreeHeader } from "./tree/header";
import { studyMaterialsTreeVariants } from "./tree/variants";

export type StudyMaterialsTreeSize = "sm" | "default" | "lg";

export interface ProductionStudyMaterialsTreeProps {
  folders: readonly FolderDTO[];
  materials: readonly StudyMaterialDTO[];
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelectedChange?: (id: string | null) => void;
  onCommand?: TreeCommandExecutor;
  onMaterialActivate?: (materialId: string) => void;
  size?: StudyMaterialsTreeSize;
  className?: string;
  expandedIds?: Set<string>;
  onExpandedChange?: (ids: Set<string>) => void;
  /**
   * When true, renders prototype-specific copy (empty state and delete dialog).
   * Production uses generic copy.
   */
  isPrototype?: boolean;
  /** Panel chrome: when provided, header shows collapse toggle and content is conditionally hidden */
  isPanelExpanded?: boolean;
  onPanelToggle?: () => void;
  /** Override for CardContent height, e.g. "h-[250px]" */
  contentClassName?: string;
}

export function StudyMaterialsTree({
  folders,
  materials,
  selectedId,
  defaultSelectedId,
  onSelectedChange,
  onCommand,
  onMaterialActivate,
  size = "sm",
  className,
  expandedIds,
  onExpandedChange,
  isPrototype = false,
  isPanelExpanded,
  onPanelToggle,
  contentClassName,
}: ProductionStudyMaterialsTreeProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(
    defaultSelectedId !== undefined ? defaultSelectedId : null,
  );
  const effectiveSelected = selectedId !== undefined ? selectedId : internalSelected;
  const setSelected = useCallback(
    (id: string | null) => {
      if (selectedId === undefined) setInternalSelected(id);
      onSelectedChange?.(id);
    },
    [onSelectedChange, selectedId],
  );

  const [lastAction, setLastAction] = useState("Ready");
  void lastAction;

  const effectiveState = useMemo<TreeState>(
    () => ({ folders: [...folders], materials: [...materials] }),
    [folders, materials],
  );

  const controller = useStudyMaterialsTreeController({
    folders: effectiveState.folders,
    materials: effectiveState.materials,
    selectedId: effectiveSelected,
    setSelectedId: setSelected,
    onCommand,
    onMaterialActivate,
    onInternalStateChange: onCommand ? undefined : undefined,
    setLastAction,
    size,
    expandedIds,
    onExpandedChange,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const activeDragNode = useMemo(
    () => findTreeNode(controller.tree, controller.activeDragItemId),
    [controller.activeDragItemId, controller.tree],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const dragData = getTreeDragData(event.active.data.current);
      if (!dragData) return;
      controller.beginDrag(dragData.itemId, getItemName(effectiveState, dragData.itemId) ?? "item");
    },
    [controller, effectiveState],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const dragData = getTreeDragData(event.active.data.current);
      const dropData = getTreeDropData(event.over?.data.current);
      void controller.endDrag(
        dragData?.itemId ?? null,
        dropData ? (dropData.folderId as string | null) : null,
      );
    },
    [controller],
  );

  const handleDragCancel = useCallback(() => {
    controller.cancelDrag();
  }, [controller]);

  return (
    <TooltipProvider>
      <DndContext
        collisionDetection={pointerWithin}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <TreeControllerProvider controller={controller}>
          <div
            ref={controller.registerTreeSurface}
            data-slot="study-materials-tree"
            data-size={size}
            className={cn(studyMaterialsTreeVariants({ size }), className)}
          >
            <Card size="sm" className="gap-0 overflow-hidden !rounded-2xl bg-study-materials-panel py-0 shadow-none">
              <TreeHeader isPanelExpanded={isPanelExpanded} onPanelToggle={onPanelToggle} />
              {(isPanelExpanded === undefined || isPanelExpanded) && (
                <CardContent className={cn("min-h-0 p-0 !rounded-b-2xl overflow-hidden", contentClassName ?? "h-[400px]")}>
                <ContextMenu>
                  <ContextMenuContent className="min-w-52">
                    <ContextMenuGroup>
                      <ContextMenuItem onClick={() => controller.createFolder(null)}>
                        <FolderPlus />
                        New folder
                      </ContextMenuItem>
                    </ContextMenuGroup>
                    <ContextMenuSeparator />
                    <ContextMenuGroup>
                      <ContextMenuItem onClick={controller.expandAll}>
                        <FolderOpen />
                        Expand all
                      </ContextMenuItem>
                      <ContextMenuItem onClick={controller.collapseAll}>
                        <ChevronsUpDown />
                        Collapse all
                      </ContextMenuItem>
                    </ContextMenuGroup>
                  </ContextMenuContent>
                  <ContextMenuTrigger className="block h-full">
                    {controller.tree.length === 0 ? (
                      <EmptyState
                        data-slot="study-materials-tree-empty-state"
                        className="h-full py-6"
                        icon={<Folder className="size-5 text-muted-foreground" />}
                        title="No study materials"
                        description={
                          isPrototype
                            ? "Create a folder to begin the in-memory prototype."
                            : "Create a folder to begin."
                        }
                      />
                    ) : (
                      <ScrollArea className="h-full">
                        <div
                          data-slot="study-materials-tree-content"
                          role="tree"
                          aria-label="Study materials"
                          className="min-h-full min-w-0 py-1"
                        >
                          {controller.tree.map((node) => (
                            <Branch key={node.id} node={node} depth={0} />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </ContextMenuTrigger>
                </ContextMenu>
              </CardContent>
              )}
            </Card>
          </div>
          <DragOverlay dropAnimation={null}>{activeDragNode ? <DragPreview node={activeDragNode} /> : null}</DragOverlay>
        </TreeControllerProvider>
      </DndContext>
      <ConfirmDeleteDialog
        open={controller.pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) controller.cancelDelete();
        }}
        title={`Delete ${controller.pendingDelete?.type === "folder" ? "folder" : "study material"}`}
        description={
          isPrototype
            ? `Delete "${controller.pendingDelete?.name ?? ""}" from this in-memory prototype?`
            : `Delete "${controller.pendingDelete?.name ?? ""}"?`
        }
        onConfirm={controller.confirmDelete}
      />
    </TooltipProvider>
  );
}

// Re-export for convenience
export type { TreeNode, TreeState } from "../model/tree";
export type { TreeCommand, TreeCommandExecutor, CommandResult } from "../model/commands";
