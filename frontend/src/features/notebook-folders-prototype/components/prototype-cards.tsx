import { useCallback, useRef, useState, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { FolderInput, Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/shared/utils/cn";
import { getFolderCovers } from "../model/artwork-assets";
import type { CoverVariants } from "../model/types";
import { MAX_TITLE_LENGTH } from "../model/title";
import { useFittedFolderTitle } from "../hooks/use-fitted-folder-title";
import { EmptyFolderArtwork, SingleFolderArtwork, DoubleFolderArtwork, ManyFolderArtwork, CoveredNotebookArtwork, EmptyNotebookArtwork } from "./exported-artwork";
import { InlineEditableText } from "./inline-editable-text";
import "./prototype-cards.css";

type FolderRef = { id: string; name: string };
type NotebookCover = { id: string; title: string; coverUrl: string | null; coverVariants?: CoverVariants | null };
export type FolderCardProps = { folder: FolderRef; notebooks: NotebookCover[]; autoEdit?: boolean; onOpen: () => void; onRename: (name: string) => void; onCancelEdit?: () => void; onDismissEdit?: (name: string) => void; onRemove: () => void };
export type NotebookCardProps = { notebook: { id: string; title: string; description: string; coverUrl: string | null; coverVariants?: CoverVariants | null; folderId: string | null }; folders: FolderRef[]; autoEdit?: boolean; onMove: (folderId: string | null) => void; onOpen: () => void; onRename: (name: string) => void; onCancelEdit?: () => void; onDismissEdit?: (name: string) => void };
export type NotebookPreviewProps = { notebook: { title: string; coverUrl: string | null; coverVariants?: CoverVariants | null } };

export function FolderCard({ folder, notebooks, autoEdit, onOpen, onRename, onCancelEdit, onDismissEdit, onRemove }: FolderCardProps) {
  const { setNodeRef } = useDroppable({ id: `folder:${folder.id}`, data: { folderId: folder.id } });
  const [editRequest, requestEdit] = useState(autoEdit ? 1 : 0);
  const [editingTitle, setEditingTitle] = useState(false);
  const wasEditingRef = useRef(false);
  const openSuppressedUntilRef = useRef(0);

  const handleTitleEditingChange = useCallback((editing: boolean) => {
    if (wasEditingRef.current && !editing) openSuppressedUntilRef.current = Date.now() + 500;
    wasEditingRef.current = editing;
    setEditingTitle(editing);
  }, []);

  const handleOpen = () => {
    if (editingTitle || Date.now() < openSuppressedUntilRef.current) return;
    onOpen();
  };

  return <ContextMenu>
    <ContextMenuTrigger render={<article ref={setNodeRef} className="prototype-folder-card" onDoubleClick={handleOpen} tabIndex={0} aria-label={`${folder.name}, ${notebooks.length} notebooks`} onKeyDown={(event) => { if (event.key === "Enter" && !editingTitle) onOpen(); if (event.key === "F2") requestEdit((value) => value + 1); }} />}>
      <FolderArtwork title={folder.name} notebooks={notebooks} onRename={onRename} onCancelEdit={onCancelEdit} onDismissEdit={onDismissEdit} onEditingChange={handleTitleEditingChange} editRequest={editRequest} />
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onClick={() => requestEdit((value) => value + 1)}>Rename <span className="ml-auto text-xs text-muted-foreground">F2</span></ContextMenuItem>
      <ContextMenuItem variant="destructive" onClick={onRemove}><Trash2 />Remove Folder</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>;
}

function FolderArtwork({ title, notebooks, onRename, onCancelEdit, onDismissEdit, onEditingChange, editRequest }: { title: string; notebooks: NotebookCover[]; onRename: (name: string) => void; onCancelEdit?: () => void; onDismissEdit?: (name: string) => void; onEditingChange?: (editing: boolean) => void; editRequest: number }) {
  const covers = getFolderCovers(notebooks);
  const titleFontSize = useFittedFolderTitle(title);
  const titleSlot = <InlineEditableText value={title} onSave={onRename} onCancel={onCancelEdit} onDismiss={onDismissEdit} onEditingChange={onEditingChange} ariaLabel={`folder ${title}`} editRequest={editRequest} maxLength={MAX_TITLE_LENGTH} tooltip={title} className="prototype-artwork__title-editor" inputClassName="prototype-artwork__title-input"><span>{title}</span></InlineEditableText>;
  const props = { title, titleFontSize, titleSlot };
  return <span className="prototype-artwork">{notebooks.length === 0 ? <EmptyFolderArtwork {...props} /> : notebooks.length === 1 ? <SingleFolderArtwork {...props} covers={covers} /> : notebooks.length === 2 ? <DoubleFolderArtwork {...props} covers={covers} /> : <ManyFolderArtwork {...props} covers={covers} extraCount={notebooks.length - 2} />}</span>;
}

function NotebookArtwork({ notebook, titleSlot }: NotebookPreviewProps & { titleSlot?: ReactNode }) {
  // Not aria-hidden: the title slot contains the inline-edit control, and an
  // aria-hidden element must not contain focusable content.
  return <span className="prototype-artwork">{notebook.coverUrl ? <CoveredNotebookArtwork title={notebook.title} coverUrl={notebook.coverUrl} coverVariants={notebook.coverVariants} titleSlot={titleSlot} /> : <EmptyNotebookArtwork title={notebook.title} titleSlot={titleSlot} />}</span>;
}

export function NotebookCard({ notebook, folders, autoEdit, onMove, onOpen, onRename, onCancelEdit, onDismissEdit }: NotebookCardProps) {
  const { attributes, listeners, isDragging, setNodeRef } = useDraggable({ id: notebook.id, data: { notebookId: notebook.id } });
  const [editRequest, requestEdit] = useState(autoEdit ? 1 : 0);
  const [editingTitle, setEditingTitle] = useState(false);
  const wasEditingRef = useRef(false);
  const openSuppressedUntilRef = useRef(0);

  const handleTitleEditingChange = useCallback((editing: boolean) => {
    if (wasEditingRef.current && !editing) openSuppressedUntilRef.current = Date.now() + 500;
    wasEditingRef.current = editing;
    setEditingTitle(editing);
  }, []);

  const handleOpen = () => {
    if (editingTitle || Date.now() < openSuppressedUntilRef.current) return;
    onOpen();
  };

  const titleSlot = <InlineEditableText value={notebook.title} onSave={onRename} onCancel={onCancelEdit} onDismiss={onDismissEdit} onEditingChange={handleTitleEditingChange} ariaLabel={`notebook ${notebook.title}`} editRequest={editRequest} autoSize maxLength={MAX_TITLE_LENGTH} tooltip={notebook.title} className="prototype-artwork__title-editor" inputClassName="prototype-notebook-title-input"><span>{notebook.title}</span></InlineEditableText>;
  // A <div>, not <article>: dnd-kit imposes role="button" on the draggable
  // card, and the button role is not allowed on <article>.
  return <ContextMenu>
    <ContextMenuTrigger render={<div ref={setNodeRef} {...attributes} {...listeners} className={cn("prototype-notebook-card", isDragging && "prototype-notebook-card--dragging")} onDoubleClick={handleOpen} tabIndex={0} aria-label={notebook.title} onKeyDown={(event) => { if (event.key === "Enter" && !editingTitle) onOpen(); if (event.key === "F2") requestEdit((value) => value + 1); }} />}>
      <NotebookArtwork notebook={notebook} titleSlot={titleSlot} />
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onClick={() => requestEdit((value) => value + 1)}>Rename <span className="ml-auto text-xs text-muted-foreground">F2</span></ContextMenuItem>
      <ContextMenuItem disabled={notebook.folderId === null} onClick={() => onMove(null)}><FolderInput />Move To Library</ContextMenuItem>
      {folders.map((folder) => <ContextMenuItem key={folder.id} disabled={folder.id === notebook.folderId} onClick={() => onMove(folder.id)}><FolderInput />Move To {folder.name}</ContextMenuItem>)}
    </ContextMenuContent>
  </ContextMenu>;
}

export function NotebookPreview({ notebook }: NotebookPreviewProps) {
  return <div className="prototype-notebook-preview" aria-label={`Moving ${notebook.title}`}><NotebookArtwork notebook={notebook} /></div>;
}
