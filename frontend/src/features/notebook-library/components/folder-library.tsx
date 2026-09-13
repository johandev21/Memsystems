import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ArrowUpDown, ChevronRight, NotebookText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  canMoveFolder,
  childFolders,
  descendantNotebooks,
  folderAncestors,
  folderPath,
} from "../model/folder-hierarchy";

export interface FolderLibraryProps {
  folders: LibraryFolder[];
  notebooks: LibraryNotebook[];
  activeFolderId: string | null;
  sortKey: LibrarySortKey;
  draftId: string | null;
  selectedKey: string | null;
  onSortChange: (sortKey: LibrarySortKey) => void;
  onCommitDraft: (name: string) => void;
  onCancelDraft: () => void;
  onSelectItem: (key: string | null) => void;
  onOpenFolder: (id: string | null) => void;
  onMoveNotebook: (id: string, folderId: string | null) => void;
  onMoveFolder: (id: string, folderId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onRemoveFolder: (id: string) => void;
  onOpenNotebook: (id: string) => void;
  onUpdateNotebook: (id: string, patch: { title?: string; description?: string }) => void;
}

export function FolderLibrary({
  folders,
  notebooks,
  activeFolderId,
  sortKey,
  draftId,
  selectedKey,
  onSortChange,
  onCommitDraft,
  onCancelDraft,
  onSelectItem,
  onOpenFolder,
  onMoveNotebook,
  onMoveFolder,
  onRenameFolder,
  onRemoveFolder,
  onOpenNotebook,
  onUpdateNotebook,
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
  const folderPaths = new Map(folders.map((folder) => [folder.id, folderPath(folders, folder.id)]));
  const moveDestinations = (folderId: string) => [
    {
      id: null,
      label: t("library.library"),
      disabled: !canMoveFolder(folders, folderId, null),
    },
    ...folders.map((folder) => ({
      id: folder.id,
      label: folderPaths.get(folder.id) ?? folder.name,
      disabled: !canMoveFolder(folders, folderId, folder.id),
    })),
  ];
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

  return (
    <div className="flex flex-col gap-4">
      {activeFolder && <Breadcrumb folders={breadcrumbs} onOpenFolder={onOpenFolder} />}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          {activeFolder?.name ?? t("library.library")}
        </h2>
        <Select
          items={sortOptions}
          value={sortKey}
          onValueChange={(value) => onSortChange(value as LibrarySortKey)}
        >
          <SelectTrigger size="sm" aria-label={t("library.sort.aria")}>
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
      <LibraryGrid
        items={items}
        folderNotebooks={folderNotebooks}
        folders={folders}
        folderPaths={folderPaths}
        destinationFolderId={activeFolderId}
        draftId={draftId}
        selectedKey={selectedKey}
        onCommitDraft={onCommitDraft}
        onCancelDraft={onCancelDraft}
        onSelectItem={onSelectItem}
        emptyState={
          activeFolder
            ? {
                title: t("library.emptyFolderTitle"),
                description: t("library.emptyFolderDescription"),
              }
            : {
                title: t("library.emptyLibraryTitle"),
                description: t("library.emptyLibraryDescription"),
              }
        }
        onOpenFolder={onOpenFolder}
        onMoveNotebook={onMoveNotebook}
        onMoveFolder={onMoveFolder}
        moveDestinations={moveDestinations}
        onRenameFolder={onRenameFolder}
        onRemoveFolder={onRemoveFolder}
        onOpenNotebook={onOpenNotebook}
        onUpdateNotebook={onUpdateNotebook}
      />
    </div>
  );
}

function LibraryGrid({
  items,
  folderNotebooks,
  folders,
  folderPaths,
  destinationFolderId,
  draftId,
  selectedKey,
  onCommitDraft,
  onCancelDraft,
  onSelectItem,
  emptyState,
  onOpenFolder,
  onMoveNotebook,
  onMoveFolder,
  moveDestinations,
  onRenameFolder,
  onRemoveFolder,
  onOpenNotebook,
  onUpdateNotebook,
}: {
  items: LibraryItem[];
  folderNotebooks: Map<string, LibraryNotebook[]>;
  folders: LibraryFolder[];
  folderPaths: Map<string, string>;
  destinationFolderId: string | null;
  draftId: string | null;
  selectedKey: string | null;
  onCommitDraft: (name: string) => void;
  onCancelDraft: () => void;
  onSelectItem: FolderLibraryProps["onSelectItem"];
  emptyState: { title: string; description: string };
  onOpenFolder: FolderLibraryProps["onOpenFolder"];
  onMoveNotebook: FolderLibraryProps["onMoveNotebook"];
  onMoveFolder: FolderLibraryProps["onMoveFolder"];
  moveDestinations: (
    folderId: string,
  ) => { id: string | null; label: string; disabled?: boolean }[];
  onRenameFolder: FolderLibraryProps["onRenameFolder"];
  onRemoveFolder: FolderLibraryProps["onRemoveFolder"];
  onOpenNotebook: FolderLibraryProps["onOpenNotebook"];
  onUpdateNotebook: FolderLibraryProps["onUpdateNotebook"];
}) {
  const { setNodeRef } = useDroppable({
    id: `library:${destinationFolderId ?? "root"}`,
    data: { folderId: destinationFolderId },
  });

  if (!items.length) {
    return (
      <section ref={setNodeRef}>
        <EmptyLibrary title={emptyState.title} description={emptyState.description} />
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      className="library-grid"
      onClick={(event) => {
        if (event.target === event.currentTarget) onSelectItem(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onSelectItem(null);
      }}
    >
      {items.map((item) =>
        item.kind === "folder" ? (
          <FolderCard
            key={`folder:${item.folder.id}`}
            folder={item.folder}
            notebooks={folderNotebooks.get(item.folder.id) ?? []}
            selected={selectedKey === `folder:${item.folder.id}`}
            autoEdit={item.folder.id === draftId}
            onSelect={() => onSelectItem(`folder:${item.folder.id}`)}
            onOpen={() => onOpenFolder(item.folder.id)}
            onMove={(folderId) => onMoveFolder(item.folder.id, folderId)}
            moveDestinations={moveDestinations(item.folder.id)}
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
            key={`notebook:${item.notebook.id}`}
            notebook={item.notebook}
            folders={folders}
            folderPaths={folderPaths}
            selected={selectedKey === `notebook:${item.notebook.id}`}
            autoEdit={item.notebook.id === draftId}
            onSelect={() => onSelectItem(`notebook:${item.notebook.id}`)}
            onMove={(folderId) => onMoveNotebook(item.notebook.id, folderId)}
            onOpen={() => onOpenNotebook(item.notebook.id)}
            onRename={
              item.notebook.id === draftId
                ? onCommitDraft
                : (name) => onUpdateNotebook(item.notebook.id, { title: name })
            }
            onCancelEdit={item.notebook.id === draftId ? onCancelDraft : undefined}
            onDismissEdit={item.notebook.id === draftId ? onCommitDraft : undefined}
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
  return (
    <nav
      aria-label={t("library.breadcrumbAria")}
      className="flex items-center gap-1 text-sm text-muted-foreground"
    >
      <BreadcrumbTarget id={null} label={t("library.library")} onOpenFolder={onOpenFolder} />
      {folders.map((folder) => (
        <span key={folder.id} className="contents">
          <ChevronRight className="size-4" />
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
  const { setNodeRef } = useDroppable({ id: `breadcrumb:${id ?? "root"}`, data: { folderId: id } });
  return current ? (
    <span ref={setNodeRef} aria-current="page" className="min-w-0 truncate text-foreground">
      {label}
    </span>
  ) : (
    <button
      ref={setNodeRef}
      type="button"
      className="rounded-md px-2 py-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
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
