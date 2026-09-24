import { useCallback, useRef, useState, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { chatMessagesQueryOptions } from "@/features/notebook-chat/api/chat";
import { notebookQueryOptions } from "@/features/notebooks/api";
import { cn } from "@/shared/utils/cn";
import { getFolderCovers } from "../model/artwork-assets";
import { isTempId } from "../model/temp-id";
import type { CoverVariants } from "../model/types";
import { MAX_TITLE_LENGTH } from "../model/title";
import { useFittedFolderTitle } from "../hooks/use-fitted-folder-title";
import {
  EmptyFolderArtwork,
  SingleFolderArtwork,
  DoubleFolderArtwork,
  ManyFolderArtwork,
  CoveredNotebookArtwork,
  EmptyNotebookArtwork,
} from "./exported-artwork";
import { InlineEditableText } from "./inline-editable-text";

type FolderRef = { id: string; name: string };
type NotebookCover = {
  id: string;
  title: string;
  coverUrl: string | null;
  coverVariants?: CoverVariants | null;
};
export type FolderCardProps = {
  folder: FolderRef;
  notebooks: NotebookCover[];
  selected?: boolean;
  autoEdit?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  onRename: (name: string) => void;
  onCancelEdit?: () => void;
  onDismissEdit?: (name: string) => void;
  onRemove: () => void;
};
export type NotebookCardProps = {
  notebook: {
    id: string;
    title: string;
    description: string;
    coverUrl: string | null;
    coverVariants?: CoverVariants | null;
    folderId: string | null;
  };
  selected?: boolean;
  autoEdit?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  onRename: (name: string) => void;
  onCancelEdit?: () => void;
  onDismissEdit?: (name: string) => void;
  onRemove: () => void;
};
export type NotebookPreviewProps = {
  notebook: { title: string; coverUrl: string | null; coverVariants?: CoverVariants | null };
};
export type FolderPreviewProps = { folder: FolderRef; notebooks: NotebookCover[] };

export function FolderCard({
  folder,
  notebooks,
  selected,
  autoEdit,
  onSelect,
  onOpen,
  onRename,
  onCancelEdit,
  onDismissEdit,
  onRemove,
}: FolderCardProps) {
  const { t } = useTranslation("notebooks");
  const { setNodeRef: setDropRef } = useDroppable({
    id: `folder:${folder.id}`,
    data: { folderId: folder.id },
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: `folder:${folder.id}`, data: { kind: "folder", folderId: folder.id } });
  const [editRequest, requestEdit] = useState(autoEdit ? 1 : 0);
  const editingTitleRef = useRef(Boolean(autoEdit));
  const openSuppressedUntilRef = useRef(0);

  const handleTitleEditingChange = useCallback((editing: boolean) => {
    if (editingTitleRef.current && !editing) openSuppressedUntilRef.current = Date.now() + 500;
    editingTitleRef.current = editing;
  }, []);

  const handleOpen = () => {
    if (editingTitleRef.current || Date.now() < openSuppressedUntilRef.current) return;
    onOpen();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={(node) => {
              setDropRef(node);
              setDragRef(node);
            }}
            {...attributes}
            role={attributes.role}
            {...listeners}
            className={cn("library-folder-card", isDragging && "library-notebook-card--dragging")}
            data-selected={selected ? "true" : undefined}
            onClick={() => {
              if (!editingTitleRef.current) onSelect?.();
            }}
            onContextMenu={() => onSelect?.()}
            onDoubleClick={handleOpen}
            tabIndex={0}
            aria-label={t("library.folderCardAria", {
              name: folder.name,
              count: notebooks.length,
            })}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" && !editingTitleRef.current) onOpen();
              if (event.key === "F2") {
                editingTitleRef.current = true;
                requestEdit((value) => value + 1);
              }
              listeners?.onKeyDown?.(event);
            }}
          />
        }
      >
        <FolderArtwork
          title={folder.name}
          notebooks={notebooks}
          onRename={onRename}
          onCancelEdit={onCancelEdit}
          onDismissEdit={onDismissEdit}
          onEditingChange={handleTitleEditingChange}
          editRequest={editRequest}
        />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            editingTitleRef.current = true;
            requestEdit((value) => value + 1);
          }}
        >
          {t("library.rename")} <span className="ml-auto text-xs text-muted-foreground">F2</span>
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onRemove}>
          <Trash2 />
          {t("library.removeFolder")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FolderArtwork({
  title,
  notebooks,
  onRename,
  onCancelEdit,
  onDismissEdit,
  onEditingChange,
  editRequest,
}: {
  title: string;
  notebooks: NotebookCover[];
  onRename: (name: string) => void;
  onCancelEdit?: () => void;
  onDismissEdit?: (name: string) => void;
  onEditingChange?: (editing: boolean) => void;
  editRequest: number;
}) {
  const covers = getFolderCovers(notebooks);
  const titleFontSize = useFittedFolderTitle(title);
  const titleSlot = (
    <InlineEditableText
      value={title}
      onSave={onRename}
      onCancel={onCancelEdit}
      onDismiss={onDismissEdit}
      onEditingChange={onEditingChange}
      ariaLabel={`folder ${title}`}
      editRequest={editRequest}
      maxLength={MAX_TITLE_LENGTH}
      tooltip={title}
      className="library-artwork__title-editor"
      inputClassName="library-artwork__title-input"
    >
      <span>{title}</span>
    </InlineEditableText>
  );
  const props = { title, titleFontSize, titleSlot };
  return (
    <span className="library-artwork">
      {notebooks.length === 0 ? (
        <EmptyFolderArtwork {...props} />
      ) : notebooks.length === 1 ? (
        <SingleFolderArtwork {...props} covers={covers} />
      ) : notebooks.length === 2 ? (
        <DoubleFolderArtwork {...props} covers={covers} />
      ) : (
        <ManyFolderArtwork {...props} covers={covers} extraCount={notebooks.length - 2} />
      )}
    </span>
  );
}

function NotebookArtwork({
  notebook,
  titleSlot,
}: NotebookPreviewProps & { titleSlot?: ReactNode }) {
  // Not aria-hidden: the title slot contains the inline-edit control, and an
  // aria-hidden element must not contain focusable content.
  return (
    <span className="library-artwork">
      {notebook.coverUrl ? (
        <CoveredNotebookArtwork
          title={notebook.title}
          coverUrl={notebook.coverUrl}
          coverVariants={notebook.coverVariants}
          titleSlot={titleSlot}
        />
      ) : (
        <EmptyNotebookArtwork title={notebook.title} titleSlot={titleSlot} />
      )}
    </span>
  );
}

export function NotebookCard({
  notebook,
  selected,
  autoEdit,
  onSelect,
  onOpen,
  onRename,
  onCancelEdit,
  onDismissEdit,
  onRemove,
}: NotebookCardProps) {
  const { t } = useTranslation("notebooks");
  const queryClient = useQueryClient();
  const { attributes, listeners, isDragging, setNodeRef } = useDraggable({
    id: `notebook:${notebook.id}`,
    data: { kind: "notebook", notebookId: notebook.id },
  });
  // Warm the notebook + chat caches on intent so opening a notebook renders
  // immediately. Optimistic temp cards have no server record to prefetch.
  const prefetch = useCallback(() => {
    if (isTempId(notebook.id)) return;
    void queryClient.prefetchQuery(notebookQueryOptions(notebook.id));
    void queryClient.prefetchQuery(chatMessagesQueryOptions(notebook.id));
  }, [notebook.id, queryClient]);
  const [editRequest, requestEdit] = useState(autoEdit ? 1 : 0);
  const editingTitleRef = useRef(Boolean(autoEdit));
  const openSuppressedUntilRef = useRef(0);

  const handleTitleEditingChange = useCallback((editing: boolean) => {
    if (editingTitleRef.current && !editing) openSuppressedUntilRef.current = Date.now() + 500;
    editingTitleRef.current = editing;
  }, []);

  const handleOpen = () => {
    if (editingTitleRef.current || Date.now() < openSuppressedUntilRef.current) return;
    onOpen();
  };

  const titleSlot = (
    <InlineEditableText
      value={notebook.title}
      onSave={onRename}
      onCancel={onCancelEdit}
      onDismiss={onDismissEdit}
      onEditingChange={handleTitleEditingChange}
      ariaLabel={`notebook ${notebook.title}`}
      editRequest={editRequest}
      autoSize
      maxLength={MAX_TITLE_LENGTH}
      tooltip={notebook.title}
      className="library-artwork__title-editor"
      inputClassName="library-notebook-title-input"
    >
      <span>{notebook.title}</span>
    </InlineEditableText>
  );
  // A <div>, not <article>: dnd-kit imposes role="button" on the draggable
  // card, and the button role is not allowed on <article>.
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={setNodeRef}
            {...attributes}
            role={attributes.role}
            {...listeners}
            className={cn("library-notebook-card", isDragging && "library-notebook-card--dragging")}
            data-selected={selected ? "true" : undefined}
            onMouseEnter={prefetch}
            onFocus={prefetch}
            onClick={() => {
              if (!editingTitleRef.current) onSelect?.();
            }}
            onContextMenu={() => onSelect?.()}
            onDoubleClick={handleOpen}
            tabIndex={0}
            aria-label={notebook.title}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" && !editingTitleRef.current) onOpen();
              if (event.key === "F2") {
                editingTitleRef.current = true;
                requestEdit((value) => value + 1);
              }
              listeners?.onKeyDown?.(event);
            }}
          />
        }
      >
        <NotebookArtwork notebook={notebook} titleSlot={titleSlot} />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            editingTitleRef.current = true;
            requestEdit((value) => value + 1);
          }}
        >
          {t("library.rename")} <span className="ml-auto text-xs text-muted-foreground">F2</span>
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onRemove}>
          <Trash2 />
          {t("library.removeNotebook")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function NotebookPreview({ notebook }: NotebookPreviewProps) {
  const { t } = useTranslation("notebooks");
  return (
    <div
      className="library-notebook-preview"
      aria-label={t("library.moving", { name: notebook.title })}
    >
      <NotebookArtwork notebook={notebook} />
    </div>
  );
}

export function FolderPreview({ folder, notebooks }: FolderPreviewProps) {
  const { t } = useTranslation("notebooks");
  return (
    <div className="library-folder-card" aria-label={t("library.moving", { name: folder.name })}>
      <FolderArtwork
        title={folder.name}
        notebooks={notebooks}
        onRename={() => {}}
        editRequest={0}
      />
    </div>
  );
}
