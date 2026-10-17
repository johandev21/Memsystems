import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ArrowUpDown, ChevronRight, MoreHorizontal, NotebookText, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/shared/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibraryFolder, LibraryNotebook } from "../model/types";
import {
  sortLibraryItems,
  sortNotebooks,
  toLibraryItems,
  type LibraryItem,
  type LibrarySortKey,
} from "../model/library-sort";
import { FolderCard, NotebookCard } from "./library-cards";
import { childFolders, descendantNotebooks, folderAncestors } from "../model/folder-hierarchy";
import { MobileLibraryView } from "./mobile-library-view";

export interface FolderLibraryProps {
  folders: LibraryFolder[];
  notebooks: LibraryNotebook[];
  activeFolderId: string | null;
  sortKey: LibrarySortKey;
  view?: "library" | "trash";
  onViewChange?: (view: "library" | "trash") => void;
  draftId: string | null;
  draftClientId: string | null;
  selectedKey: string | null;
  onSortChange: (sortKey: LibrarySortKey) => void;
  onCommitDraft: (name: string) => void;
  onCancelDraft: () => void;
  onSelectItem: (key: string | null) => void;
  onOpenFolder: (id: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onRemoveFolder: (id: string) => void;
  onRemoveNotebook: (id: string) => void;
  onOpenNotebook: (id: string) => void;
  onUpdateNotebook: (id: string, patch: { title?: string; description?: string; folderId?: string | null }) => void;
  onCreateFolder?: () => void;
  onCreateNotebook?: () => void;
  onCreateFolderNamed?: (name: string) => void | Promise<unknown>;
  onCreateNotebookNamed?: (title: string) => void | Promise<unknown>;
}

export function FolderLibrary({
  folders,
  notebooks,
  activeFolderId,
  sortKey,
  view = "library",
  onViewChange,
  draftId,
  draftClientId,
  selectedKey,
  onSortChange,
  onCommitDraft,
  onCancelDraft,
  onSelectItem,
  onOpenFolder,
  onRenameFolder,
  onRemoveFolder,
  onRemoveNotebook,
  onOpenNotebook,
  onUpdateNotebook,
  onCreateFolder,
  onCreateNotebook,
  onCreateFolderNamed,
  onCreateNotebookNamed,
}: FolderLibraryProps) {
  const { t, i18n } = useTranslation("notebooks");
  const locale = i18n.resolvedLanguage;
  const sortOptions: { value: LibrarySortKey; label: string; description: string }[] = [
    {
      value: "name",
      label: t("library.sort.name"),
      description: t("library.sort.nameDescription"),
    },
    {
      value: "updatedAt",
      label: t("library.sort.updatedAt"),
      description: t("library.sort.updatedAtDescription"),
    },
    {
      value: "createdAt",
      label: t("library.sort.createdAt"),
      description: t("library.sort.createdAtDescription"),
    },
  ];
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const breadcrumbs = folderAncestors(folders, activeFolderId);
  const items = useMemo(() => {
    const visible =
      activeFolderId === null
        ? toLibraryItems(
            childFolders(folders, null),
            notebooks.filter((notebook) => notebook.folderId === null),
          )
        : toLibraryItems(
            childFolders(folders, activeFolderId),
            notebooks.filter((notebook) => notebook.folderId === activeFolderId),
          );
    return sortLibraryItems(visible, sortKey, locale);
  }, [activeFolderId, folders, notebooks, sortKey, locale]);
  const folderNotebooks = useMemo(
    () =>
      new Map(
        folders.map((folder) => [
          folder.id,
          sortNotebooks(descendantNotebooks(folders, notebooks, folder.id), sortKey, locale),
        ]),
      ),
    [folders, notebooks, sortKey, locale],
  );

  const emptyState = activeFolder
    ? {
        title: t("library.emptyFolderTitle"),
        description: t("library.emptyFolderDescription"),
      }
    : {
        title: t("library.emptyLibraryTitle"),
        description: t("library.emptyLibraryDescription"),
      };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="sm:hidden w-full">
        <MobileLibraryView
          folders={folders}
          notebooks={notebooks}
          items={items}
          activeFolderId={activeFolderId}
          sortKey={sortKey}
          sortOptions={sortOptions}
          onSortChange={onSortChange}
          onOpenFolder={onOpenFolder}
          onOpenNotebook={onOpenNotebook}
          onRenameFolder={onRenameFolder}
          onRemoveFolder={onRemoveFolder}
          onRemoveNotebook={onRemoveNotebook}
          onUpdateNotebook={onUpdateNotebook}
          onCreateFolder={onCreateFolder}
          onCreateNotebook={onCreateNotebook}
          onCreateFolderNamed={onCreateFolderNamed}
          onCreateNotebookNamed={onCreateNotebookNamed}
          emptyState={emptyState}
          view={view}
          onViewChange={onViewChange}
        />
      </div>

      <div className="hidden sm:flex flex-col gap-4 w-full">
        {activeFolder && <Breadcrumb folders={breadcrumbs} onOpenFolder={onOpenFolder} />}
        <div className="flex items-start sm:items-center justify-between gap-4 min-w-0">
          <h2
            dir="auto"
            className="text-lg font-semibold text-foreground min-w-0 break-words [overflow-wrap:anywhere] line-clamp-3"
            title={activeFolder?.name ?? t("library.library")}
          >
            {activeFolder?.name ?? t("library.library")}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {onViewChange && (
              <button
                type="button"
                onClick={() => onViewChange(view === "trash" ? "library" : "trash")}
                aria-label="Trash"
                className={cn(
                  "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors active:scale-97 select-none touch-manipulation",
                  view === "trash"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Trash2 className="size-3.5" />
                <span>Trash</span>
              </button>
            )}
            <Select
              items={sortOptions}
              value={sortKey}
              onValueChange={(value) => onSortChange(value as LibrarySortKey)}
            >
              <SelectTrigger size="sm" aria-label={t("library.sort.aria")} className="shrink-0">
                <ArrowUpDown className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-56">
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
        </div>
        <LibraryGrid
          items={items}
          folderNotebooks={folderNotebooks}
          destinationFolderId={activeFolderId}
          draftId={draftId}
          draftClientId={draftClientId}
          selectedKey={selectedKey}
          onCommitDraft={onCommitDraft}
          onCancelDraft={onCancelDraft}
          onSelectItem={onSelectItem}
          emptyState={emptyState}
          onOpenFolder={onOpenFolder}
          onRenameFolder={onRenameFolder}
          onRemoveFolder={onRemoveFolder}
          onRemoveNotebook={onRemoveNotebook}
          onOpenNotebook={onOpenNotebook}
          onUpdateNotebook={onUpdateNotebook}
        />
      </div>
    </div>
  );
}

function LibraryGrid({
  items,
  folderNotebooks,
  destinationFolderId,
  draftId,
  draftClientId,
  selectedKey,
  onCommitDraft,
  onCancelDraft,
  onSelectItem,
  emptyState,
  onOpenFolder,
  onRenameFolder,
  onRemoveFolder,
  onRemoveNotebook,
  onOpenNotebook,
  onUpdateNotebook,
}: {
  items: LibraryItem[];
  folderNotebooks: Map<string, LibraryNotebook[]>;
  destinationFolderId: string | null;
  draftId: string | null;
  draftClientId: string | null;
  selectedKey: string | null;
  onCommitDraft: (name: string) => void;
  onCancelDraft: () => void;
  onSelectItem: FolderLibraryProps["onSelectItem"];
  emptyState: { title: string; description: string };
  onOpenFolder: FolderLibraryProps["onOpenFolder"];
  onRenameFolder: FolderLibraryProps["onRenameFolder"];
  onRemoveFolder: FolderLibraryProps["onRemoveFolder"];
  onRemoveNotebook: FolderLibraryProps["onRemoveNotebook"];
  onOpenNotebook: FolderLibraryProps["onOpenNotebook"];
  onUpdateNotebook: FolderLibraryProps["onUpdateNotebook"];
}) {
  const { setNodeRef } = useDroppable({
    id: `library:${destinationFolderId ?? "root"}`,
    data: { folderId: destinationFolderId },
  });
  const [gridElement, setGridElement] = useState<HTMLElement | null>(null);

  const handleGridRef = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setGridElement(node);
    },
    [setNodeRef],
  );

  const onDeselect = useEffectEvent(() => {
    onSelectItem(null);
  });

  useEffect(() => {
    if (!gridElement) return;

    const handleClick = (event: MouseEvent) => {
      if (event.target === event.currentTarget) onDeselect();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDeselect();
    };

    gridElement.addEventListener("click", handleClick);
    gridElement.addEventListener("keydown", handleKeyDown);
    return () => {
      gridElement.removeEventListener("click", handleClick);
      gridElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [gridElement]);

  if (!items.length) {
    return (
      <section ref={setNodeRef}>
        <EmptyLibrary title={emptyState.title} description={emptyState.description} />
      </section>
    );
  }

  return (
    <section ref={handleGridRef} className="library-grid">
      {items.map((item) =>
        item.kind === "folder" ? (
          <FolderCard
            key={`folder:${item.folder.id === draftId && draftClientId ? draftClientId : item.folder.id}`}
            folder={item.folder}
            notebooks={folderNotebooks.get(item.folder.id) ?? []}
            selected={selectedKey === `folder:${item.folder.id}`}
            autoEdit={item.folder.id === draftId}
            onSelect={() => onSelectItem(`folder:${item.folder.id}`)}
            onOpen={() => onOpenFolder(item.folder.id)}
            onRename={
              item.folder.id === draftId
                ? onCommitDraft
                : (name) => onRenameFolder(item.folder.id, name)
            }
            onCancelEdit={item.folder.id === draftId ? onCancelDraft : undefined}
            onDismissEdit={item.folder.id === draftId ? onCommitDraft : undefined}
            onRemove={() => onRemoveFolder(item.folder.id)}
          />
        ) : (
          <NotebookCard
            key={`notebook:${item.notebook.id === draftId && draftClientId ? draftClientId : item.notebook.id}`}
            notebook={item.notebook}
            selected={selectedKey === `notebook:${item.notebook.id}`}
            autoEdit={item.notebook.id === draftId}
            onSelect={() => onSelectItem(`notebook:${item.notebook.id}`)}
            onOpen={() => onOpenNotebook(item.notebook.id)}
            onRename={
              item.notebook.id === draftId
                ? onCommitDraft
                : (name) => onUpdateNotebook(item.notebook.id, { title: name })
            }
            onCancelEdit={item.notebook.id === draftId ? onCancelDraft : undefined}
            onDismissEdit={item.notebook.id === draftId ? onCommitDraft : undefined}
            onRemove={() => onRemoveNotebook(item.notebook.id)}
          />
        ),
      )}
    </section>
  );
}

function Breadcrumb({
  folders,
  onOpenFolder,
}: {
  folders: LibraryFolder[];
  onOpenFolder: (id: string | null) => void;
}) {
  const { t } = useTranslation("notebooks");
  const shouldCollapse = folders.length > 3;
  const collapsedFolders = shouldCollapse ? folders.slice(0, -2) : [];
  const visibleFolders = shouldCollapse ? folders.slice(-2) : folders;

  return (
    <nav
      aria-label={t("library.breadcrumbAria")}
      className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap min-w-0"
    >
      <BreadcrumbTarget id={null} label={t("library.library")} onOpenFolder={onOpenFolder} />
      {shouldCollapse && (
        <span className="inline-flex items-center gap-1 shrink-0">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center size-6 rounded-md hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none"
              aria-label="Show ancestor folders"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48 max-w-72">
              {collapsedFolders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => onOpenFolder(folder.id)}
                  className="cursor-pointer truncate text-sm"
                  title={folder.name}
                >
                  <span className="truncate" dir="auto">{folder.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      )}
      {visibleFolders.map((folder) => (
        <span key={folder.id} className="inline-flex items-center gap-1 min-w-0">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
          <BreadcrumbTarget
            id={folder.id}
            label={folder.name}
            current={folder.id === folders.at(-1)?.id}
            onOpenFolder={onOpenFolder}
          />
        </span>
      ))}
    </nav>
  );
}

function BreadcrumbTarget({
  id,
  label,
  current,
  onOpenFolder,
}: {
  id: string | null;
  label: string;
  current?: boolean;
  onOpenFolder: (id: string | null) => void;
}) {
  const { t } = useTranslation("notebooks");
  const { isOver, setNodeRef } = useDroppable({
    id: `breadcrumb:${id ?? "root"}`,
    data: { folderId: id },
  });
  const highlightClass = isOver ? "bg-accent/60 text-accent-foreground" : undefined;
  return current ? (
    <span
      ref={setNodeRef}
      aria-current="page"
      data-drop-target={isOver ? "valid" : undefined}
      dir="auto"
      className={cn("min-w-0 max-w-44 sm:max-w-64 truncate rounded-md text-foreground font-medium", highlightClass)}
      title={label}
    >
      {label}
    </span>
  ) : (
    <button
      ref={setNodeRef}
      type="button"
      data-drop-target={isOver ? "valid" : undefined}
      dir="auto"
      className={cn(
        "rounded-md px-1.5 py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring min-w-0 max-w-32 sm:max-w-48 truncate cursor-pointer transition-colors",
        highlightClass,
      )}
      onClick={() => onOpenFolder(id)}
      title={t("library.dropToMove", { target: label })}
    >
      {label}
    </button>
  );
}

function EmptyLibrary({ title, description }: { title: string; description: string }) {
  return (
    <EmptyState
      icon={<NotebookText className="size-7 text-muted-foreground" />}
      title={title}
      description={description}
    />
  );
}
