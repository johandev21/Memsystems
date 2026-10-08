import { useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderInput,
  FolderPlus,
  MoreVertical,
  NotebookPen,
  NotebookText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/shared/utils/cn";
import { folderAncestors } from "../model/folder-hierarchy";
import type { LibraryItem, LibrarySortKey } from "../model/library-sort";
import type { LibraryFolder, LibraryNotebook } from "../model/types";

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
  const { t } = useTranslation("notebooks");
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const breadcrumbs = folderAncestors(folders, activeFolderId);
  const parentFolder = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;

  // Drawer states for management actions
  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleOpenActionDrawer = (item: LibraryItem) => {
    setActiveItem(item);
  };

  const handleStartRename = () => {
    if (!activeItem) return;
    const currentName =
      activeItem.kind === "folder" ? activeItem.folder.name : activeItem.notebook.title;
    setRenameValue(currentName);
    setIsRenameOpen(true);
  };

  const handleConfirmRename = () => {
    if (!activeItem || !renameValue.trim()) return;
    const trimmed = renameValue.trim();
    if (activeItem.kind === "folder") {
      onRenameFolder(activeItem.folder.id, trimmed);
    } else {
      onUpdateNotebook(activeItem.notebook.id, { title: trimmed });
    }
    setIsRenameOpen(false);
    setActiveItem(null);
  };

  const handleDeleteItem = () => {
    if (!activeItem) return;
    if (activeItem.kind === "folder") {
      onRemoveFolder(activeItem.folder.id);
    } else {
      onRemoveNotebook(activeItem.notebook.id);
    }
    setActiveItem(null);
  };

  const handleMoveNotebook = (targetFolderId: string | null) => {
    if (!activeItem || activeItem.kind !== "notebook") return;
    onUpdateNotebook(activeItem.notebook.id, { folderId: targetFolderId });
    setIsMoveOpen(false);
    setActiveItem(null);
  };

  return (
    <div className="flex flex-col gap-3 pb-24 w-full">
      {/* Mobile Navigation Header (Ticket 02) */}
      <header className="sticky top-0 z-20 flex flex-col gap-2 bg-background/95 pb-2 pt-1.5 backdrop-blur-xs w-full">
        <div className="flex items-center justify-between gap-2 w-full">
          {activeFolderId ? (
            <button
              type="button"
              onClick={() => onOpenFolder(parentFolder?.id ?? null)}
              className="group inline-flex items-center gap-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-97 touch-manipulation cursor-pointer"
              aria-label={t("library.back", "Back")}
            >
              <ChevronLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
              <span className="max-w-[180px] truncate" aria-hidden="true">
                {parentFolder?.name ?? t("library.library")}
              </span>
            </button>
          ) : (
            <div className="text-sm font-medium text-muted-foreground">
              {t("library.library")}
            </div>
          )}

          <Select
            items={sortOptions}
            value={sortKey}
            onValueChange={(value) => onSortChange(value as LibrarySortKey)}
          >
            <SelectTrigger
              size="sm"
              className="h-8 gap-1.5 rounded-full px-2.5 text-xs touch-manipulation"
              aria-label={t("library.sort.aria")}
            >
              <ArrowUpDown className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-56" align="end">
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="items-start py-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
          {activeFolder?.name ?? t("library.library")}
        </h1>
      </header>

      {/* Tactile Item Tiles List (Ticket 03) */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-12 px-4 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            {activeFolderId ? <Folder className="size-6" /> : <NotebookText className="size-6" />}
          </div>
          <p className="text-base font-medium text-foreground">{emptyState.title}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{emptyState.description}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full" role="list">
          {items.map((item) =>
            item.kind === "folder" ? (
              <MobileFolderTile
                key={`folder:${item.folder.id}`}
                folder={item.folder}
                onOpen={() => onOpenFolder(item.folder.id)}
                onActions={() => handleOpenActionDrawer(item)}
              />
            ) : (
              <MobileNotebookTile
                key={`notebook:${item.notebook.id}`}
                notebook={item.notebook}
                onOpen={() => onOpenNotebook(item.notebook.id)}
                onActions={() => handleOpenActionDrawer(item)}
              />
            ),
          )}
        </div>
      )}

      {/* Action Drawer (Ticket 04) */}
      <Drawer
        open={activeItem !== null && !isRenameOpen && !isMoveOpen}
        onOpenChange={(open) => {
          if (!open) setActiveItem(null);
        }}
      >
        <DrawerContent className="p-4 pb-safe-lg">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base font-semibold truncate">
              {activeItem?.kind === "folder"
                ? activeItem.folder.name
                : activeItem?.notebook.title}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {activeItem?.kind === "folder" ? t("library.folder") : t("library.notebook")}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-1 py-2">
            <button
              type="button"
              onClick={handleStartRename}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-95 transition-transform transition-colors touch-manipulation cursor-pointer"
            >
              <Pencil className="size-4 text-muted-foreground" />
              <span>{t("library.rename")}</span>
            </button>

            {activeItem?.kind === "notebook" && (
              <button
                type="button"
                onClick={() => setIsMoveOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-95 transition-transform transition-colors touch-manipulation cursor-pointer"
              >
                <FolderInput className="size-4 text-muted-foreground" />
                <span>{t("library.moveToFolder", "Move to folder")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDeleteItem}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-95 transition-transform transition-colors touch-manipulation cursor-pointer"
            >
              <Trash2 className="size-4" />
              <span>
                {activeItem?.kind === "folder"
                  ? t("library.removeFolder")
                  : t("library.removeNotebook")}
              </span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Rename Drawer (Ticket 04) with >=16px font size to prevent iOS auto-zoom */}
      <Drawer open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DrawerContent className="p-4 pb-safe-lg">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-semibold">
              {t("library.rename")}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {activeItem?.kind === "folder"
                ? t("folders.newFolderPlaceholder", "New folder name...")
                : t("banner.titlePlaceholder", "Notebook Title")}
            </DrawerDescription>
          </DrawerHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmRename();
            }}
            className="flex flex-col gap-4 py-2"
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="h-11 text-base rounded-xl"
              placeholder={
                activeItem?.kind === "folder"
                  ? t("folders.newFolderPlaceholder", "Folder name")
                  : t("banner.titlePlaceholder", "Notebook title")
              }
            />

            <DrawerFooter className="flex-row gap-2 p-0">
              <DrawerClose render={<Button variant="outline" className="flex-1 rounded-xl h-10 text-sm">
                {t("banner.cancelEdits", "Cancel")}
              </Button>} />
              <Button
                type="submit"
                disabled={!renameValue.trim()}
                className="flex-1 rounded-xl h-10 text-sm"
              >
                {t("banner.save", "Save")}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      {/* Folder Picker Sheet (Ticket 05) */}
      <Drawer open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DrawerContent className="p-4 pb-safe-lg max-h-[70vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-semibold">
              {t("library.selectDestinationFolder", "Select destination folder")}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {activeItem?.kind === "notebook" ? activeItem.notebook.title : ""}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-1 overflow-y-auto py-2">
            <button
              type="button"
              onClick={() => handleMoveNotebook(null)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl p-3 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98] touch-manipulation cursor-pointer",
                activeItem?.kind === "notebook" && activeItem.notebook.folderId === null
                  ? "bg-muted text-foreground"
                  : "text-foreground",
              )}
            >
              <span className="flex items-center gap-2.5">
                <Folder className="size-4 text-primary" />
                <span>{t("folders.notebookRoot", "Library Root")}</span>
              </span>
              {activeItem?.kind === "notebook" && activeItem.notebook.folderId === null && (
                <span className="text-xs text-muted-foreground">Current</span>
              )}
            </button>

            {folders.map((folder) => {
              const isCurrent =
                activeItem?.kind === "notebook" && activeItem.notebook.folderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => handleMoveNotebook(folder.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl p-3 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98] touch-manipulation cursor-pointer",
                    isCurrent ? "bg-muted text-foreground" : "text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Folder className="size-4 text-primary shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  {isCurrent && <span className="text-xs text-muted-foreground">Current</span>}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Creation Sheet & Floating Action Button (Ticket 06) */}
      {(onCreateNotebook || onCreateFolder) && (
        <>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            aria-label={t("library.create.aria")}
            className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform duration-100 ease-out touch-manipulation cursor-pointer"
          >
            <Plus className="size-6 stroke-2" />
          </button>

          <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DrawerContent className="p-4 pb-safe-lg">
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-base font-semibold">
                  {t("library.create.label")}
                </DrawerTitle>
              </DrawerHeader>

              <div className="flex flex-col gap-2 py-2">
                {onCreateNotebook && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(false);
                      onCreateNotebook();
                    }}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-border/40 bg-card p-3.5 text-left transition-colors hover:bg-muted active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <NotebookPen className="size-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {t("library.create.notebook")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("library.create.notebookDescription")}
                      </span>
                    </div>
                  </button>
                )}

                {onCreateFolder && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(false);
                      onCreateFolder();
                    }}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-border/40 bg-card p-3.5 text-left transition-colors hover:bg-muted active:scale-95 touch-manipulation cursor-pointer"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FolderPlus className="size-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {t("library.create.folder")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("library.create.folderDescription")}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </div>
  );
}

function MobileFolderTile({
  folder,
  onOpen,
  onActions,
}: {
  folder: LibraryFolder;
  onOpen: () => void;
  onActions: () => void;
}) {
  const { t } = useTranslation("notebooks");
  return (
    <div
      role="listitem"
      className="group relative flex w-full items-center justify-between rounded-2xl border border-border/40 bg-card p-3 shadow-2xs transition-transform transition-colors hover:bg-muted/40 active:scale-95 duration-150 ease-out touch-manipulation select-none"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Folder className="size-5 fill-primary/20" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium leading-snug text-foreground">
            {folder.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("library.folder")}
          </span>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onActions();
          }}
          aria-label={t("library.itemActions", { name: folder.name, defaultValue: `Actions for ${folder.name}` })}
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform touch-manipulation cursor-pointer"
        >
          <MoreVertical className="size-4" />
        </button>
        <ChevronRight className="size-4 text-muted-foreground/40 shrink-0 mr-1" />
      </div>
    </div>
  );
}

function MobileNotebookTile({
  notebook,
  onOpen,
  onActions,
}: {
  notebook: LibraryNotebook;
  onOpen: () => void;
  onActions: () => void;
}) {
  const { t } = useTranslation("notebooks");
  return (
    <div
      role="listitem"
      className="group relative flex w-full items-center justify-between rounded-2xl border border-border/40 bg-card p-3 shadow-2xs transition-transform transition-colors hover:bg-muted/40 active:scale-95 duration-150 ease-out touch-manipulation select-none"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
      >
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
          {notebook.coverUrl ? (
            <img src={notebook.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <NotebookText className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium leading-snug text-foreground">
            {notebook.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("library.notebook")}
          </span>
        </div>
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onActions();
          }}
          aria-label={t("library.itemActions", { name: notebook.title, defaultValue: `Actions for ${notebook.title}` })}
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform touch-manipulation cursor-pointer"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}
