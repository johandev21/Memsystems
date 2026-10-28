import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  type useSensors,
} from "@dnd-kit/core";
import { ChevronsUpDown, FileText, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { memo, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "@/shared/components/ui/confirm-delete-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/components/ui/context-menu";
import { TreeSearchBar, type useTreeSearch } from "@/shared/components/ui/tree";
import { cn } from "@/shared/utils/cn";
import { SourcesPanelHeader } from "./sources-panel-header";
import type { Source } from "../api/sources";
import type { SourceFolder } from "../types/source-folder.types";
import { sourceDisplayTitle } from "../utils/source-display-title";
import {
  useSourcesPanelController,
  type SourceDeleteTarget,
} from "../hooks/use-sources-panel-controller";
import { AddSourceDialog } from "./add-source-dialog";
import { PendingUploadRow } from "./pending-upload-row";
import { SourcesList } from "./sources-list/sources-list";
import { SourceIcon } from "./sources-list/source-icon";
import { MobileSourcesView } from "./mobile/mobile-sources-view";

export interface SourcesPanelProps {
  notebookId: string;
  collapsed?: boolean;
  onSelectSource: (id: string) => void;
  onToggleCollapse?: () => void;
  showHeader?: boolean;
}

export const SourcesPanel = memo(function SourcesPanel({
  notebookId,
  collapsed,
  onSelectSource,
  onToggleCollapse,
  showHeader = true,
}: SourcesPanelProps) {
  const {
    isMobileLayout,
    mobileViewProps,
    sourceToDelete,
    setSourceToDelete,
    confirmSourceDelete,
    deleteMutation,
    folderToDelete,
    setFolderToDelete,
    confirmFolderDelete,
    activeDragId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    sensors,
    canMove,
    search,
    pendingUploads,
    cancelPendingUpload,
    handleCreateFolder,
    expandAll,
    collapseAll,
    sourceListProps,
    sources,
    folders,
    setScrollElement,
  } = useSourcesPanelController(notebookId, onSelectSource);

  return isMobileLayout ? (
    <MobileSourcesPanel
      {...mobileViewProps}
      sourceToDelete={sourceToDelete}
      onCloseDelete={() => setSourceToDelete(null)}
      onConfirmDelete={confirmSourceDelete}
      isDeleting={deleteMutation.isPending}
    />
  ) : (
    <DesktopSourcesPanel
      notebookId={notebookId}
      collapsed={collapsed}
      showHeader={showHeader}
      onToggleCollapse={onToggleCollapse}
      canMove={canMove}
      search={search}
      pendingUploads={pendingUploads}
      onCancelPendingUpload={cancelPendingUpload}
      onCreateFolder={handleCreateFolder}
      onExpandAll={expandAll}
      onCollapseAll={collapseAll}
      sourceListProps={sourceListProps}
      scrollElementRef={setScrollElement}
      sourceToDelete={sourceToDelete}
      folderToDelete={folderToDelete}
      onCloseSourceDelete={() => setSourceToDelete(null)}
      onConfirmSourceDelete={confirmSourceDelete}
      onCloseFolderDelete={() => setFolderToDelete(null)}
      onConfirmFolderDelete={confirmFolderDelete}
      isDeletingSource={deleteMutation.isPending}
      activeDragId={activeDragId}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      sensors={sensors}
      sources={sources ?? []}
      folders={folders ?? []}
    />
  );
});

function MobileSourcesPanel({
  sourceToDelete,
  onCloseDelete,
  onConfirmDelete,
  isDeleting,
  ...viewProps
}: ComponentProps<typeof MobileSourcesView> & {
  sourceToDelete: SourceDeleteTarget;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation("sources");
  return (
    <>
      <MobileSourcesView {...viewProps} />
      <ConfirmDeleteDialog
        open={sourceToDelete !== null}
        onOpenChange={(open) => !open && onCloseDelete()}
        title={t("panel.deleteTitle")}
        description={t("panel.deleteDescription", { title: sourceToDelete?.title ?? "" })}
        onConfirm={onConfirmDelete}
        isLoading={isDeleting}
      />
    </>
  );
}

interface DesktopSourcesPanelProps {
  notebookId: string;
  collapsed?: boolean;
  showHeader: boolean;
  onToggleCollapse?: () => void;
  canMove: (itemId: string, targetFolderId: string | null) => boolean;
  search: ReturnType<typeof useTreeSearch>;
  pendingUploads: ComponentProps<typeof MobileSourcesView>["pendingUploads"];
  onCancelPendingUpload: ComponentProps<typeof MobileSourcesView>["onCancelPendingUpload"];
  onCreateFolder: (parentId: string | null) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  sourceListProps: ComponentProps<typeof SourcesList>;
  scrollElementRef: (element: HTMLDivElement | null) => void;
  sourceToDelete: SourceDeleteTarget;
  folderToDelete: SourceFolder | null;
  onCloseSourceDelete: () => void;
  onConfirmSourceDelete: () => void;
  onCloseFolderDelete: () => void;
  onConfirmFolderDelete: () => void;
  isDeletingSource: boolean;
  activeDragId: string | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  sensors: ReturnType<typeof useSensors>;
  sources: Source[];
  folders: SourceFolder[];
}

function DesktopSourcesPanel({
  notebookId,
  collapsed,
  showHeader,
  onToggleCollapse,
  canMove,
  search,
  pendingUploads,
  onCancelPendingUpload,
  onCreateFolder,
  onExpandAll,
  onCollapseAll,
  sourceListProps,
  scrollElementRef,
  sourceToDelete,
  folderToDelete,
  onCloseSourceDelete,
  onConfirmSourceDelete,
  onCloseFolderDelete,
  onConfirmFolderDelete,
  isDeletingSource,
  activeDragId,
  onDragStart,
  onDragEnd,
  onDragCancel,
  sensors,
  sources,
  folders,
}: DesktopSourcesPanelProps) {
  const { t } = useTranslation(["sources", "tree"]);
  return (
    <DndContext
      collisionDetection={pointerWithin}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="relative flex h-full min-w-0 flex-col bg-panel-bg">
        {showHeader && (
          <SourcesPanelHeader
            collapsed={Boolean(collapsed)}
            notebookId={notebookId}
            onToggleCollapse={onToggleCollapse}
            canMove={canMove}
            isSearchOpen={search.isSearchOpen}
            onToggleSearch={search.toggleSearch}
          />
        )}

        {search.isSearchOpen && !collapsed && (
          <div className="px-2 pt-2">
            <TreeSearchBar
              value={search.searchQuery}
              onChange={search.setSearchQuery}
              onClear={search.clearSearch}
              onClose={search.toggleSearch}
              matchCount={search.matchCount}
              isSearching={search.isSearching}
              placeholder={t("panel.searchPlaceholder")}
            />
          </div>
        )}

        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", collapsed && "hidden")}>
          <ContextMenu>
            <ContextMenuTrigger
              ref={scrollElementRef}
              data-slot="sources-panel-content"
              className="native-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-auto p-2"
            >
              {pendingUploads.map((upload) => (
                <PendingUploadRow key={upload.id} upload={upload} onCancel={onCancelPendingUpload} />
              ))}
              <SourcesList {...sourceListProps} collapsed={Boolean(collapsed)} />
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-48">
              <ContextMenuGroup>
                <ContextMenuItem onClick={() => onCreateFolder(null)}>
                  <FolderPlus className="size-4 mr-2" />
                  {t("tree:actions.newFolder", "New folder")}
                </ContextMenuItem>
              </ContextMenuGroup>
              <ContextMenuSeparator />
              <ContextMenuGroup>
                <ContextMenuItem onClick={onExpandAll}>
                  <FolderOpen className="size-4 mr-2" />
                  {t("tree:actions.expandAll", "Expand all")}
                </ContextMenuItem>
                <ContextMenuItem onClick={onCollapseAll}>
                  <ChevronsUpDown className="size-4 mr-2" />
                  {t("tree:actions.collapseAll", "Collapse all")}
                </ContextMenuItem>
              </ContextMenuGroup>
            </ContextMenuContent>
          </ContextMenu>

          <div className="p-2">
            <AddSourceDialog notebookId={notebookId}>
              <div className="cursor-pointer rounded-2xl border-2 border-dashed border-border p-4 text-center text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
                {t("sources:panel.addSourcesPrompt")}
              </div>
            </AddSourceDialog>
          </div>
        </div>

        <ConfirmDeleteDialog
          open={sourceToDelete !== null}
          onOpenChange={(open) => !open && onCloseSourceDelete()}
          title={t("sources:panel.deleteTitle")}
          description={t("sources:panel.deleteDescription", { title: sourceToDelete?.title ?? "" })}
          onConfirm={onConfirmSourceDelete}
          isLoading={isDeletingSource}
        />
        <ConfirmDeleteDialog
          open={folderToDelete !== null}
          onOpenChange={(open) => !open && onCloseFolderDelete()}
          title={t("tree:deleteDialog.folderTitle", "Delete folder")}
          description={t("tree:deleteDialog.folderDescription", { name: folderToDelete?.name ?? "" })}
          onConfirm={onConfirmFolderDelete}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragId ? (
          <SourcesDragPreview itemId={activeDragId} sources={sources} folders={folders} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SourcesDragPreview({
  itemId,
  sources,
  folders,
}: {
  itemId: string;
  sources: readonly Source[];
  folders: readonly SourceFolder[];
}) {
  const folder = folders.find((f) => f.id === itemId);
  const source = sources.find((s) => s.id === itemId);
  const name = folder?.name ?? (source ? sourceDisplayTitle(source) : "Item");
  const isFolder = Boolean(folder);

  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-border/80 bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg">
      {isFolder ? (
        <Folder className="size-4 shrink-0 text-muted-foreground" />
      ) : source ? (
        <SourceIcon source={source} className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="max-w-48 truncate">{name}</span>
    </div>
  );
}
