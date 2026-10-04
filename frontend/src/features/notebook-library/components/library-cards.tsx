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

/**
 * Shared title-editing plumbing for the folder and notebook cards. Renaming is
 * explicit (F2 or the card context menu); this hook owns the `editRequest`
 * counter the title field watches, the "an edit is in flight" flag that keeps a
 * click from selecting the card, and the post-edit click/double-click guard.
 */
function useCardTitleEditing({ autoEdit, onOpen }: { autoEdit?: boolean; onOpen: () => void }) {
  const [editRequest, requestEdit] = useState(autoEdit ? 1 : 0);
  const editingTitleRef = useRef(Boolean(autoEdit));
  const openSuppressedUntilRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTitleEditingChange = useCallback((editing: boolean) => {
    const wasEditing = editingTitleRef.current;
    editingTitleRef.current = editing;
    if (!wasEditing || editing) return;
    // The blur that ends an edit is immediately followed by the click or
    // double-click that caused it, so swallow that open. Focus then goes back
    // to the card, unless the pointer already moved focus somewhere else.
    openSuppressedUntilRef.current = Date.now() + 500;
    if (document.activeElement === document.body) cardRef.current?.focus();
  }, []);

  const beginRename = useCallback(() => {
    editingTitleRef.current = true;
    requestEdit((value) => value + 1);
  }, []);

  const handleOpen = useCallback(() => {
    if (editingTitleRef.current || Date.now() < openSuppressedUntilRef.current) return;
    onOpen();
  }, [onOpen]);

  return {
    beginRename,
    cardRef,
    editRequest,
    handleOpen,
    handleTitleEditingChange,
    titleEditingRef: editingTitleRef,
  };
}

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
  compact?: boolean;
};
export type FolderPreviewProps = {
  folder: FolderRef;
  notebooks: NotebookCover[];
  compact?: boolean;
};

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
  const {
    beginRename,
    cardRef,
    editRequest,
    handleOpen,
    handleTitleEditingChange,
    titleEditingRef,
  } = useCardTitleEditing({ autoEdit, onOpen });

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            ref={(node) => {
              setDropRef(node);
              setDragRef(node);
              cardRef.current = node;
            }}
            {...attributes}
            role={attributes.role}
            {...listeners}
            className={cn("library-folder-card", isDragging && "library-notebook-card--dragging")}
            data-selected={selected ? "true" : undefined}
            onClick={() => {
              if (!titleEditingRef.current) onSelect?.();
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
              if (event.key === "Enter" && !titleEditingRef.current) onOpen();
              if (event.key === "F2") beginRename();
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
          ariaLabel={t("library.folder")}
        />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={beginRename}>
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
  ariaLabel,
  hideTitle,
}: {
  title: string;
  notebooks: NotebookCover[];
  onRename: (name: string) => void;
  onCancelEdit?: () => void;
  onDismissEdit?: (name: string) => void;
  onEditingChange?: (editing: boolean) => void;
  editRequest: number;
  ariaLabel: string;
  hideTitle?: boolean;
}) {
  const covers = getFolderCovers(notebooks);
  const titleFontSize = useFittedFolderTitle(hideTitle ? "" : title);
  // Compact drag preview over breadcrumbs: keep the positioned title slot
  // (so the artwork shape is unchanged) but render it empty — the name
  // would be unreadable at ~0.45 scale and the user already knows the item.
  const titleSlot = hideTitle ? (
    <span aria-hidden="true" />
  ) : (
    <InlineEditableText
      value={title}
      onSave={onRename}
      onCancel={onCancelEdit}
      onDismiss={onDismissEdit}
      onEditingChange={onEditingChange}
      ariaLabel={ariaLabel}
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
  hideTitle,
}: NotebookPreviewProps & { titleSlot?: ReactNode; hideTitle?: boolean }) {
  // Not aria-hidden: the title slot contains the inline-edit control, and an
  // aria-hidden element must not contain focusable content.
  // Compact drag preview outside the main area hides the whole label
  // (icon pill + name): unreadable at ~0.45 scale, and the cover art alone
  // identifies the notebook.
  return (
    <span className="library-artwork">
      {notebook.coverUrl ? (
        <CoveredNotebookArtwork
          title={notebook.title}
          coverUrl={notebook.coverUrl}
          coverVariants={notebook.coverVariants}
          titleSlot={titleSlot}
          hideLabel={hideTitle}
        />
      ) : (
        <EmptyNotebookArtwork
          title={notebook.title}
          titleSlot={titleSlot}
          hideLabel={hideTitle}
        />
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
  const {
    beginRename,
    cardRef,
    editRequest,
    handleOpen,
    handleTitleEditingChange,
    titleEditingRef,
  } = useCardTitleEditing({ autoEdit, onOpen });

  const titleSlot = (
    <InlineEditableText
      value={notebook.title}
      onSave={onRename}
      onCancel={onCancelEdit}
      onDismiss={onDismissEdit}
      onEditingChange={handleTitleEditingChange}
      ariaLabel={t("library.notebook")}
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
            ref={(node) => {
              setNodeRef(node);
              cardRef.current = node;
            }}
            {...attributes}
            role={attributes.role}
            {...listeners}
            className={cn("library-notebook-card", isDragging && "library-notebook-card--dragging")}
            data-selected={selected ? "true" : undefined}
            onMouseEnter={prefetch}
            onFocus={prefetch}
            onClick={() => {
              if (!titleEditingRef.current) onSelect?.();
            }}
            onContextMenu={() => onSelect?.()}
            onDoubleClick={handleOpen}
            tabIndex={0}
            aria-label={notebook.title}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" && !titleEditingRef.current) onOpen();
              if (event.key === "F2") beginRename();
              listeners?.onKeyDown?.(event);
            }}
          />
        }
      >
        <NotebookArtwork notebook={notebook} titleSlot={titleSlot} />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={beginRename}>
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

export function NotebookPreview({ notebook, compact }: NotebookPreviewProps) {
  const { t } = useTranslation("notebooks");
  return (
    <div
      className={cn("library-notebook-preview", compact && "library-drag-preview--compact")}
      aria-label={t("library.moving", { name: notebook.title })}
    >
      <NotebookArtwork notebook={notebook} hideTitle={compact} />
    </div>
  );
}

export function FolderPreview({ folder, notebooks, compact }: FolderPreviewProps) {
  const { t } = useTranslation("notebooks");
  return (
    <div
      className={cn("library-folder-card", compact && "library-drag-preview--compact")}
      aria-label={t("library.moving", { name: folder.name })}
    >
      <FolderArtwork
        title={folder.name}
        notebooks={notebooks}
        onRename={() => {}}
        editRequest={0}
        ariaLabel={t("library.folder")}
        hideTitle={compact}
      />
    </div>
  );
}
