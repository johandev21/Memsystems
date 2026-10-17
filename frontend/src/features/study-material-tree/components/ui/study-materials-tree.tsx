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
import {
  TreeFloatingActionDock,
  TreeFolderPickerDialog,
  TreeSearchBar,
} from "@/components/ui/tree";
import { ChevronsUpDown, Command, Folder, FolderOpen, FolderPlus, Search } from "lucide-react";
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
  // Search & Multiselect
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  matchCount?: number;
  isItemVisible?: (itemId: string, folderId?: string | null) => boolean;
  isFolderVisible?: (folderId: string) => boolean;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  isMultiselectMode?: boolean;
  onToggleMultiselect?: () => void;
  selectedIds?: Set<string>;
  onToggleItemSelect?: (id: string) => void;
  onToggleFolderSelect?: (descendantIds: string[]) => void;
  isFolderSelected?: (descendantIds: string[]) => boolean | "indeterminate";
  onClearSelection?: () => void;
  onBatchMove?: (materialIds: string[], targetFolderId: string | null) => Promise<void>;
  onBatchDelete?: (materialIds: string[]) => Promise<void>;
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
  isMultiselectMode,
  onToggleMultiselect,
  selectedIds,
  onToggleItemSelect,
  onToggleFolderSelect,
  isFolderSelected,
  onClearSelection,
  onBatchMove,
  onBatchDelete,
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

  const [isBatchMoveOpen, setIsBatchMoveOpen] = useState(false);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [activeDragBundleCount, setActiveDragBundleCount] = useState<number | undefined>();

  const folderPickerOptions = useMemo(
    () => folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
    [folders],
  );

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
    isMultiselectMode,
    onToggleMultiselect,
    selectedIds,
    onToggleItemSelect,
    onToggleFolderSelect,
    isFolderSelected,
    onBatchMove,
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
      setActiveDragBundleCount(dragData.bundledIds?.length);
      controller.beginDrag(dragData.itemId, getItemName(effectiveState, dragData.itemId) ?? "item");
    },
    [controller, effectiveState],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const dragData = getTreeDragData(event.active.data.current);
      const dropData = getTreeDropData(event.over?.data.current);
      setActiveDragBundleCount(undefined);

      if (dragData?.bundledIds && dragData.bundledIds.length > 0 && onBatchMove) {
        const targetFolderId = dropData ? (dropData.folderId as string | null) : null;
        void onBatchMove(dragData.bundledIds as string[], targetFolderId);
        return;
      }

      void controller.endDrag(
        dragData?.itemId ?? null,
        dropData ? (dropData.folderId as string | null) : null,
      );
    },
    [controller, onBatchMove],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragBundleCount(undefined);
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
                isMultiselectMode={isMultiselectMode}
                onToggleMultiselect={onToggleMultiselect}
              />
              {isSearchOpen && (
                <div className="border-b border-border/60 bg-panel-header-bg/50 px-2 py-1.5">
                  <TreeSearchBar
                    value={searchQuery ?? ""}
                    onChange={onSearchChange ?? (() => {})}
                    onClear={() => onSearchChange?.("")}
                    onClose={onToggleSearch}
                    matchCount={matchCount}
                    isSearching={Boolean(searchQuery && searchQuery.trim().length > 0)}
                    placeholder="Search study materials..."
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

            {isMultiselectMode && selectedIds && selectedIds.size > 0 && (
              <TreeFloatingActionDock
                selectedCount={selectedIds.size}
                itemTypeLabel="material"
                onMove={() => setIsBatchMoveOpen(true)}
                onDelete={() => setIsBatchDeleteConfirmOpen(true)}
                onDismiss={onClearSelection ?? (() => {})}
              />
            )}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeDragNode ? (
              <DragPreview node={activeDragNode} bundleCount={activeDragBundleCount} />
            ) : null}
          </DragOverlay>
        </TreeControllerProvider>
      </DndContext>
      <DeleteTreeItemDialog controller={controller} isPrototype={isPrototype} />
      <TreeFolderPickerDialog
        open={isBatchMoveOpen}
        onOpenChange={setIsBatchMoveOpen}
        folders={folderPickerOptions}
        title="Move study materials"
        description={`Move ${selectedIds?.size ?? 0} selected materials to:`}
        onConfirm={async (targetFolderId) => {
          if (selectedIds && onBatchMove) {
            await onBatchMove(Array.from(selectedIds), targetFolderId);
          }
          setIsBatchMoveOpen(false);
          onClearSelection?.();
        }}
      />
      <ConfirmDeleteDialog
        open={isBatchDeleteConfirmOpen}
        onOpenChange={setIsBatchDeleteConfirmOpen}
        title="Delete study materials"
        description={`Are you sure you want to delete ${selectedIds?.size ?? 0} selected study materials? This action cannot be undone.`}
        onConfirm={async () => {
          if (selectedIds && onBatchDelete) {
            await onBatchDelete(Array.from(selectedIds));
          }
          setIsBatchDeleteConfirmOpen(false);
          onClearSelection?.();
        }}
      />
    </TooltipProvider>
  );
}

function TreeContent({ isPrototype }: { isPrototype: boolean }) {
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
              title="No study materials found"
              description={`No materials match "${controller.searchQuery}"`}
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

export type { CommandResult, TreeCommand, TreeCommandExecutor } from "../model/commands";
export type { TreeNode, TreeState } from "../model/tree";
