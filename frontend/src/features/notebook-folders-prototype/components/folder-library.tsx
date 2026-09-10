import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ArrowUpDown, ChevronRight, NotebookText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Folder, Notebook } from "../model/types";
import { sortLibraryItems, sortNotebooks, toLibraryItems, type LibraryItem, type LibrarySortKey } from "../model/library-sort";
import { FolderCard, NotebookCard } from "./prototype-cards";

const SORT_OPTIONS: { value: LibrarySortKey; label: string; description: string }[] = [
  { value: "name", label: "Name", description: "Alphabetical order" },
  { value: "updatedAt", label: "Last modified", description: "Recently changed first" },
  { value: "createdAt", label: "Date created", description: "Recently created first" },
];

export interface FolderLibraryProps {
  folders: Folder[];
  notebooks: Notebook[];
  activeFolderId: string | null;
  sortKey: LibrarySortKey;
  draftId: string | null;
  onSortChange: (sortKey: LibrarySortKey) => void;
  onCommitDraft: (name: string) => void;
  onCancelDraft: () => void;
  onOpenFolder: (id: string | null) => void;
  onMoveNotebook: (id: string, folderId: string | null) => void;
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
  onSortChange,
  onCommitDraft,
  onCancelDraft,
  onOpenFolder,
  onMoveNotebook,
  onRenameFolder,
  onRemoveFolder,
  onOpenNotebook,
  onUpdateNotebook,
}: FolderLibraryProps) {
  const activeFolder = folders.find((folder) => folder.id === activeFolderId);
  const items = useMemo(() => {
    const visible =
      activeFolderId === null
        ? toLibraryItems(folders, notebooks.filter((notebook) => notebook.folderId === null))
        : toLibraryItems([], notebooks.filter((notebook) => notebook.folderId === activeFolderId));
    return sortLibraryItems(visible, sortKey);
  }, [activeFolderId, folders, notebooks, sortKey]);
  const folderNotebooks = useMemo(
    () =>
      new Map(
        folders.map((folder) => [
          folder.id,
          sortNotebooks(notebooks.filter((notebook) => notebook.folderId === folder.id), sortKey),
        ]),
      ),
    [folders, notebooks, sortKey],
  );

  return (
    <div className="flex flex-col gap-4">
      {activeFolder && <Breadcrumb folder={activeFolder} onBack={() => onOpenFolder(null)} />}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">{activeFolder?.name ?? "Library"}</h2>
        <Select
          items={SORT_OPTIONS}
          value={sortKey}
          onValueChange={(value) => onSortChange(value as LibrarySortKey)}
        >
          <SelectTrigger size="sm" aria-label="Sort library">
            <ArrowUpDown className="size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-56">
            {SORT_OPTIONS.map((option) => (
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
        destinationFolderId={activeFolderId}
        draftId={draftId}
        onCommitDraft={onCommitDraft}
        onCancelDraft={onCancelDraft}
        emptyState={
          activeFolder
            ? { title: "This folder is empty", description: "Drag notebooks here or use the + button to create one." }
            : { title: "No notebooks yet", description: "Use the + button to create your first notebook or folder." }
        }
        onOpenFolder={onOpenFolder}
        onMoveNotebook={onMoveNotebook}
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
  destinationFolderId,
  draftId,
  onCommitDraft,
  onCancelDraft,
  emptyState,
  onOpenFolder,
  onMoveNotebook,
  onRenameFolder,
  onRemoveFolder,
  onOpenNotebook,
  onUpdateNotebook,
}: {
  items: LibraryItem[];
  folderNotebooks: Map<string, Notebook[]>;
  folders: Folder[];
  destinationFolderId: string | null;
  draftId: string | null;
  onCommitDraft: (name: string) => void;
  onCancelDraft: () => void;
  emptyState: { title: string; description: string };
  onOpenFolder: FolderLibraryProps["onOpenFolder"];
  onMoveNotebook: FolderLibraryProps["onMoveNotebook"];
  onRenameFolder: FolderLibraryProps["onRenameFolder"];
  onRemoveFolder: FolderLibraryProps["onRemoveFolder"];
  onOpenNotebook: FolderLibraryProps["onOpenNotebook"];
  onUpdateNotebook: FolderLibraryProps["onUpdateNotebook"];
}) {
  const { setNodeRef } = useDroppable({
    id: `library:${destinationFolderId ?? "root"}`,
    data: { folderId: destinationFolderId },
  });

  if (!items.length) return <EmptyLibrary title={emptyState.title} description={emptyState.description} />;

  return (
    <section ref={setNodeRef} className="prototype-library-grid">
      {items.map((item) =>
        item.kind === "folder" ? (
          <FolderCard
            key={`folder:${item.folder.id}`}
            folder={item.folder}
            notebooks={folderNotebooks.get(item.folder.id) ?? []}
            autoEdit={item.folder.id === draftId}
            onOpen={() => onOpenFolder(item.folder.id)}
            onRename={item.folder.id === draftId ? onCommitDraft : (name) => onRenameFolder(item.folder.id, name)}
            onCancelEdit={item.folder.id === draftId ? onCancelDraft : undefined}
            onDismissEdit={item.folder.id === draftId ? onCommitDraft : undefined}
            onRemove={() => onRemoveFolder(item.folder.id)}
          />
        ) : (
          <NotebookCard
            key={`notebook:${item.notebook.id}`}
            notebook={item.notebook}
            folders={folders}
            autoEdit={item.notebook.id === draftId}
            onMove={(folderId) => onMoveNotebook(item.notebook.id, folderId)}
            onOpen={() => onOpenNotebook(item.notebook.id)}
            onRename={item.notebook.id === draftId ? onCommitDraft : (name) => onUpdateNotebook(item.notebook.id, { title: name })}
            onCancelEdit={item.notebook.id === draftId ? onCancelDraft : undefined}
            onDismissEdit={item.notebook.id === draftId ? onCommitDraft : undefined}
          />
        ),
      )}
    </section>
  );
}

function Breadcrumb({ folder, onBack }: { folder: Folder; onBack: () => void }) {
  const { setNodeRef } = useDroppable({
    id: "breadcrumb:root",
    data: { folderId: null },
  });
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      <button
        ref={setNodeRef}
        type="button"
        className="rounded-md px-2 py-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        onClick={onBack}
        title="Drop here to move to Library"
      >
        Library
      </button>
      <ChevronRight className="size-4" />
      <span aria-current="page" className="min-w-0 truncate text-foreground">
        {folder.name}
      </span>
    </nav>
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
