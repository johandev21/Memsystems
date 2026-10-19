import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
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
import {
  TreeSearchBar,
} from "@/components/ui/tree";
import { ChevronsUpDown, Folder, FolderOpen, FolderPlus, Search } from "lucide-react";
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
  isPrototype?: boolean;
  isPanelExpanded?: boolean;
  onPanelToggle?: () => void;
  contentHeight?: "desktop" | "mobile" | "standalone";
  // Search
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  matchCount?: number;
  isItemVisible?: (itemId: string, folderId?: string | null) => boolean;
  isFolderVisible?: (folderId: string) => boolean;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
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
  contentHeight = "standalone",
  searchQuery,
  onSearchChange,
  matchCount,
  isItemVisible,
  isFolderVisible,
  isSearchOpen,
  onToggleSearch,
}: ProductionStudyMaterialsTreeProps) {
  const { t } = useTranslation("tree");
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
    searchQuery,
    isItemVisible,
    isFolderVisible,
    isSearchOpen,
    onToggleSearch,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const { tree, activeDragItemId, registerTreeSurface } = controller;

  const activeDragNode = useMemo(
    () => findTreeNode(tree, activeDragItemId),
    [activeDragItemId, tree],
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
            ref={registerTreeSurface}
            data-slot="study-materials-tree"
            data-size={size}
            className={cn(
              studyMaterialsTreeVariants({ size }),
              "relative",
              isPanelExpanded && "h-full flex flex-col min-h-0",
              className,
            )}
          >
            <Card
              size="sm"
              className={cn(
                "gap-0 overflow-hidden bg-study-materials-panel py-0 shadow-none",
                isPanelExpanded
                  ? "h-full flex flex-col !rounded-none !bg-panel-bg border-none ring-0"
                  : "!rounded-2xl",
              )}
            >
              <TreeHeader
                isPanelExpanded={isPanelExpanded}
                onPanelToggle={onPanelToggle}
                isSearchOpen={isSearchOpen}
                onToggleSearch={onToggleSearch}
              />
              {isSearchOpen && (
                <div className="px-2 pt-2">
                  <TreeSearchBar
                    value={searchQuery ?? ""}
                    onChange={onSearchChange ?? (() => {})}
                    onClear={() => onSearchChange?.("")}
                    onClose={onToggleSearch}
                    matchCount={matchCount}
                    isSearching={Boolean(searchQuery && searchQuery.trim().length > 0)}
                    placeholder={t("search.placeholder")}
                  />
                </div>
              )}
              <CardContent
                className={cn(
                  "min-h-0 p-0 overflow-hidden",
                  isPanelExpanded
                    ? "flex-1 !rounded-none"
                    : cn(
                        "!rounded-b-2xl",
                        contentHeight === "desktop"
                          ? "h-62.5"
                          : contentHeight === "mobile"
                            ? "max-h-[38dvh] min-h-60 h-auto overflow-y-auto overscroll-contain"
                            : "h-100",
                      ),
                )}
              >
                <TreeContent isPrototype={isPrototype} />
              </CardContent>
            </Card>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragNode ? (
              <DragPreview node={activeDragNode} />
            ) : null}
          </DragOverlay>
        </TreeControllerProvider>
      </DndContext>
      <DeleteTreeItemDialog controller={controller} isPrototype={isPrototype} />
    </TooltipProvider>
  );
}

function TreeContent({ isPrototype }: { isPrototype: boolean }) {
  const { t } = useTranslation("tree");
  const controller = useTreeControllerContext();
  const isSearching = Boolean(controller.searchQuery && controller.searchQuery.trim().length > 0);

  return (
    <ContextMenu>
      <TreeRootMenu />
      <ContextMenuTrigger className="block h-full">
        {controller.tree.length === 0 ? (
          isSearching ? (
            <EmptyState
              data-slot="study-materials-tree-search-empty-state"
              className="h-full py-6"
              icon={<Search className="size-5 text-muted-foreground" />}
              title={t("search.emptyTitle")}
              description={t("search.emptyDescription", { query: controller.searchQuery ?? "" })}
            />
          ) : (
            <TreeEmptyState isPrototype={isPrototype} />
          )
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
    <ContextMenuContent className="min-w-48">
      <ContextMenuGroup>
        <ContextMenuItem onClick={() => controller.createFolder(null)}>
          <FolderPlus /> {t("actions.newFolder")}
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
      className="flex min-h-full min-w-0 flex-col gap-0.5 p-2"
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
          : pending?.type === "folder"
            ? t("deleteDialog.folderDescription", { name: pending.name })
            : t("deleteDialog.description", { name: pending?.name ?? "" })
      }
      onConfirm={controller.confirmDelete}
    />
  );
}

export type { CommandResult, TreeCommand, TreeCommandExecutor } from "../model/commands";
export type { TreeNode, TreeState } from "../model/tree";
