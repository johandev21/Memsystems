import { Folder, NotebookText } from "lucide-react";
import { useMobileLibraryActions } from "../hooks/use-mobile-library-actions";
import { folderAncestors } from "../model/folder-hierarchy";
import type { LibraryItem, LibrarySortKey } from "../model/library-sort";
import type { LibraryFolder, LibraryNotebook } from "../model/types";
import { MobileActionDrawer } from "./mobile-action-drawer";
import { MobileCreateDrawer } from "./mobile-create-drawer";
import { MobileLibraryHeader } from "./mobile-library-header";
import { MobileFolderTile, MobileNotebookTile } from "./mobile-library-tiles";
import { MobileMoveDrawer } from "./mobile-move-drawer";
import { MobileRenameDrawer } from "./mobile-rename-drawer";

export interface MobileLibraryViewProps {
  folders: LibraryFolder[];
  notebooks: LibraryNotebook[];
  items: LibraryItem[];
  activeFolderId: string | null;
  sortKey: LibrarySortKey;
  sortOptions: { value: LibrarySortKey; label: string; description: string }[];
  onSortChange: (sortKey: LibrarySortKey) => void;
  onOpenFolder: (id: string | null) => void;
  onOpenNotebook: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onRemoveFolder: (id: string) => void;
  onRemoveNotebook: (id: string) => void;
  onUpdateNotebook: (
    id: string,
    patch: { title?: string; description?: string; folderId?: string | null },
  ) => void;
  onCreateFolder?: () => void;
  onCreateNotebook?: () => void;
  emptyState: { title: string; description: string };
}

export function MobileLibraryView({
  folders,
  items,
  activeFolderId,
  sortKey,
  sortOptions,
  onSortChange,
  onOpenFolder,
  onOpenNotebook,
  onRenameFolder,
  onRemoveFolder,
  onRemoveNotebook,
  onUpdateNotebook,
  onCreateFolder,
  onCreateNotebook,
  emptyState,
}: MobileLibraryViewProps) {
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const breadcrumbs = folderAncestors(folders, activeFolderId);
  const parentFolder = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  const actions = useMobileLibraryActions({
    onRenameFolder,
    onRemoveFolder,
    onRemoveNotebook,
    onUpdateNotebook,
  });

  return (
    <div className="flex flex-col gap-3 pb-24 w-full">
      <MobileLibraryHeader
        activeFolder={activeFolder}
        parentFolder={parentFolder}
        sortKey={sortKey}
        sortOptions={sortOptions}
        onSortChange={onSortChange}
        onOpenFolder={onOpenFolder}
      />

      {items.length === 0 ? (
        <MobileLibraryEmptyState
          title={emptyState.title}
          description={emptyState.description}
          hasActiveFolder={Boolean(activeFolderId)}
        />
      ) : (
        <MobileLibraryItemList
          items={items}
          onOpenFolder={onOpenFolder}
          onOpenNotebook={onOpenNotebook}
          onOpenActions={actions.openActionDrawer}
        />
      )}

      <MobileActionDrawer
        item={actions.activeItem}
        isOpen={actions.activeItem !== null && !actions.isRenameOpen && !actions.isMoveOpen}
        onClose={actions.closeActionDrawer}
        onStartRename={actions.startRename}
        onStartMove={() => actions.setIsMoveOpen(true)}
        onDelete={actions.deleteItem}
      />

      <MobileRenameDrawer
        item={actions.activeItem}
        isOpen={actions.isRenameOpen}
        value={actions.renameValue}
        onOpenChange={actions.setIsRenameOpen}
        onChangeValue={actions.setRenameValue}
        onConfirm={actions.confirmRename}
      />

      <MobileMoveDrawer
        item={actions.activeItem}
        isOpen={actions.isMoveOpen}
        folders={folders}
        onOpenChange={actions.setIsMoveOpen}
        onSelectFolder={actions.moveNotebook}
      />

      <MobileCreateDrawer
        isOpen={actions.isCreateOpen}
        onOpenChange={actions.setIsCreateOpen}
        onCreateNotebook={onCreateNotebook}
        onCreateFolder={onCreateFolder}
      />
    </div>
  );
}

function MobileLibraryEmptyState({
  title,
  description,
  hasActiveFolder,
}: {
  title: string;
  description: string;
  hasActiveFolder: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-12 px-4 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
        {hasActiveFolder ? <Folder className="size-6" /> : <NotebookText className="size-6" />}
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

function MobileLibraryItemList({
  items,
  onOpenFolder,
  onOpenNotebook,
  onOpenActions,
}: {
  items: LibraryItem[];
  onOpenFolder: (id: string | null) => void;
  onOpenNotebook: (id: string) => void;
  onOpenActions: (item: LibraryItem) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-full" role="list">
      {items.map((item) =>
        item.kind === "folder" ? (
          <MobileFolderTile
            key={`folder:${item.folder.id}`}
            folder={item.folder}
            onOpen={() => onOpenFolder(item.folder.id)}
            onActions={() => onOpenActions(item)}
          />
        ) : (
          <MobileNotebookTile
            key={`notebook:${item.notebook.id}`}
            notebook={item.notebook}
            onOpen={() => onOpenNotebook(item.notebook.id)}
            onActions={() => onOpenActions(item)}
          />
        ),
      )}
    </div>
  );
}
