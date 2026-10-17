import { Folder, Notebook } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MobileCreatePromptDrawer } from "@/components/ui/mobile-create-prompt-drawer";
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
  onCreateFolderNamed?: (name: string) => void | Promise<unknown>;
  onCreateNotebookNamed?: (title: string) => void | Promise<unknown>;
  emptyState: { title: string; description: string };
  onOpenTrash?: () => void;
  onExportNotebook?: (id: string, title: string) => void;
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
  onCreateFolderNamed,
  onCreateNotebookNamed,
  emptyState,
  onOpenTrash,
  onExportNotebook,
}: MobileLibraryViewProps) {
  const { t } = useTranslation("notebooks");
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const breadcrumbs = folderAncestors(folders, activeFolderId);
  const parentFolder = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  const actions = useMobileLibraryActions({
    onRenameFolder,
    onRemoveFolder,
    onRemoveNotebook,
    onUpdateNotebook,
    onCreateFolderNamed,
    onCreateNotebookNamed,
    onExportNotebook,
  });

  return (
    <div className="flex flex-col gap-4 px-2 pb-24 w-full">
      <MobileLibraryHeader
        activeFolder={activeFolder}
        parentFolder={parentFolder}
        sortKey={sortKey}
        sortOptions={sortOptions}
        onSortChange={onSortChange}
        onOpenFolder={onOpenFolder}
        onOpenTrash={onOpenTrash}
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
        onExport={actions.exportActiveItem}
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
        onCreateNotebook={
          onCreateNotebookNamed ? actions.startCreateNotebook : onCreateNotebook
        }
        onCreateFolder={
          onCreateFolderNamed ? actions.startCreateFolder : onCreateFolder
        }
      />

      <MobileCreatePromptDrawer
        open={actions.isCreateFolderOpen}
        onOpenChange={actions.setIsCreateFolderOpen}
        title={t("library.create.newFolder", "New folder")}
        placeholder={t("library.create.folderPlaceholder", "Folder name")}
        onConfirm={actions.confirmCreateFolder}
        isSubmitting={actions.isSubmittingCreate}
      />

      <MobileCreatePromptDrawer
        open={actions.isCreateNotebookOpen}
        onOpenChange={actions.setIsCreateNotebookOpen}
        title={t("library.create.newNotebook", "New notebook")}
        placeholder={t("library.create.notebookPlaceholder", "Notebook title")}
        onConfirm={actions.confirmCreateNotebook}
        isSubmitting={actions.isSubmittingCreate}
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
        {hasActiveFolder ? <Folder className="size-6" /> : <Notebook className="size-6" />}
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
    <div className="flex flex-col gap-3.5 w-full" role="list">
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

