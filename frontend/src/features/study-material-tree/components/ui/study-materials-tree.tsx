import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { FolderDTO } from "../../types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";
import { cn } from "@/shared/utils/cn";
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
import { ChevronsUpDown, Command, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TreeCommandExecutor } from "../model/commands";
import { getItemName, type TreeState } from "../model/tree";
import { TreeControllerProvider } from "./controller";
import {
  findTreeNode,
  getTreeDragData,
  getTreeDropData,
  useStudyMaterialsTreeController,
  useTreeControllerContext,
} from "./controller-state";
import { Branch } from "./tree/branch";
import { DragPreview } from "./tree/drag-preview";
import { TreeHeader } from "./tree/header";
import { studyMaterialsTreeVariants, type StudyMaterialsTreeSize } from "./tree/variants";

export type { StudyMaterialsTreeSize } from "./tree/variants";

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
            <Card
              size="sm"
              className="gap-0 overflow-hidden !rounded-2xl bg-study-materials-panel py-0 shadow-none"
            >
              <TreeHeader isPanelExpanded={isPanelExpanded} onPanelToggle={onPanelToggle} />
              {(isPanelExpanded === undefined || isPanelExpanded) && (
                <CardContent
                  className={cn(
                    "min-h-0 p-0 !rounded-b-2xl overflow-hidden",
                    contentClassName ?? "h-[400px]",
                  )}
                >
                  <TreeContent isPrototype={isPrototype} />
                </CardContent>
              )}
            </Card>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragNode ? <DragPreview node={activeDragNode} /> : null}
          </DragOverlay>
        </TreeControllerProvider>
      </DndContext>
      <DeleteTreeItemDialog controller={controller} isPrototype={isPrototype} />
    </TooltipProvider>
  );
}

function TreeContent({ isPrototype }: { isPrototype: boolean }) {
  const controller = useTreeControllerContext();
  return (
    <ContextMenu>
      <TreeRootMenu />
      <ContextMenuTrigger className="block h-full">
        {controller.tree.length === 0 ? (
          <TreeEmptyState isPrototype={isPrototype} />
        ) : (
          <ScrollArea className="h-full">
            <TreeBranchList />
          </ScrollArea>
        )}
      </ContextMenuTrigger>
    </ContextMenu>
  );
}

function TreeRootMenu() {
  const { t } = useTranslation("tree");
  const controller = useTreeControllerContext();
  return (
    <ContextMenuContent className="min-w-56">
      <ContextMenuGroup>
        <ContextMenuItem onClick={() => controller.createFolder(null)}>
          <FolderPlus /> {t("actions.newFolder")}
          <ContextMenuShortcut className="flex items-center gap-1 tracking-normal font-sans text-xs text-muted-foreground group-focus/context-menu-item:text-accent-foreground">
            <Command className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-sans font-medium">N</span>
            <span className="sr-only">Command N</span>
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem onClick={controller.expandAll}>
          <FolderOpen /> {t("actions.expandAll")}
        </ContextMenuItem>
        <ContextMenuItem onClick={controller.collapseAll}>
          <ChevronsUpDown /> {t("actions.collapseAll")}
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  );
}

function TreeBranchList() {
  const { t } = useTranslation("tree");
  const { tree } = useTreeControllerContext();
  return (
    <div
      data-slot="study-materials-tree-content"
      role="tree"
      aria-label={t("tree.ariaLabel")}
      className="min-h-full min-w-0 py-1"
    >
      {tree.map((node) => (
        <Branch key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

function TreeEmptyState({ isPrototype }: { isPrototype: boolean }) {
  const { t } = useTranslation("tree");
  return (
    <EmptyState
      data-slot="study-materials-tree-empty-state"
      className="h-full py-6"
      icon={<Folder className="size-5 text-muted-foreground" />}
      title={t("tree.emptyTitle")}
      description={
        isPrototype ? t("tree.emptyDescriptionPrototype") : t("tree.emptyDescription")
      }
    />
  );
}

function DeleteTreeItemDialog({
  controller,
  isPrototype,
}: {
  controller: ReturnType<typeof useStudyMaterialsTreeController>;
  isPrototype: boolean;
}) {
  const pending = controller.pendingDelete;
  const { t } = useTranslation("tree");
  const handleOpenChange = (open: boolean) => {
    if (!open) controller.cancelDelete();
  };
  return (
    <ConfirmDeleteDialog
      open={pending !== null}
      onOpenChange={handleOpenChange}
      title={
        pending?.type === "folder"
          ? t("deleteDialog.folderTitle")
          : t("deleteDialog.materialTitle")
      }
      description={
        isPrototype
          ? t("deleteDialog.prototypeDescription", { name: pending?.name ?? "" })
          : t("deleteDialog.description", { name: pending?.name ?? "" })
      }
      onConfirm={controller.confirmDelete}
    />
  );
}

// Re-export for convenience
export type { CommandResult, TreeCommand, TreeCommandExecutor } from "../model/commands";
export type { TreeNode, TreeState } from "../model/tree";
