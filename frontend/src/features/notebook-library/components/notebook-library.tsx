import { useMemo, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  type Announcements,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CloudOff, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { libraryQueryOptions } from "../api/library";
import { folderPath } from "../model/folder-hierarchy";
import { useLibraryInteractions } from "../hooks/use-library-interactions";
import { useLibraryMutations } from "../hooks/use-library-mutations";
import { toLibraryNotebook } from "../model/adapters";
import type { LibrarySortKey } from "../model/library-sort";
import { clampTitle } from "../model/title";
import type { Draft, LibraryNotebook } from "../model/types";
import { CreateMenu } from "./create-menu";
import { FolderLibrary } from "./folder-library";
import { LibraryGridSkeleton } from "./library-skeleton";
import { FolderPreview, NotebookPreview } from "./library-cards";

// Keyboard drags have no pointer coordinates, so `pointerWithin` never matches
// them. Fall back to the nearest droppable center for keyboard moves.
const libraryCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

type LibraryDragData = { kind?: string; folderId?: string | null; notebookId?: string };

export function NotebookLibrary() {
  const { t } = useTranslation("notebooks");
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery(libraryQueryOptions);
  const mutations = useLibraryMutations();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<LibrarySortKey>("name");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LibraryNotebook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const folders = useMemo(() => data?.folders ?? [], [data]);
  const notebooks = useMemo(() => (data?.notebooks ?? []).map(toLibraryNotebook), [data]);

  const announcements = useMemo<Announcements>(() => {
    const activeName = (dragData: LibraryDragData | undefined) => {
      if (dragData?.kind === "folder") {
        return (
          folders.find((folder) => folder.id === dragData.folderId)?.name ??
          t("library.untitledFolder")
        );
      }
      if (dragData?.kind === "notebook") {
        return (
          notebooks.find((notebook) => notebook.id === dragData.notebookId)?.title ??
          t("library.untitledNotebook")
        );
      }
      return "";
    };
    const targetName = (dropData: LibraryDragData | undefined) => {
      if (!dropData || !("folderId" in dropData)) return null;
      return typeof dropData.folderId === "string"
        ? folderPath(folders, dropData.folderId)
        : t("library.library");
    };
    return {
      onDragStart: ({ active }) =>
        t("library.dnd.dragStart", { name: activeName(active.data.current) }),
      onDragOver: ({ active, over }) => {
        const target = targetName(over?.data.current);
        return target
          ? t("library.dnd.dragOver", { name: activeName(active.data.current), target })
          : t("library.dnd.dragOverNone", { name: activeName(active.data.current) });
      },
      onDragEnd: ({ active, over }) => {
        const target = targetName(over?.data.current);
        return target
          ? t("library.dnd.dragEnd", { name: activeName(active.data.current), target })
          : t("library.dnd.dragEndNone", { name: activeName(active.data.current) });
      },
      onDragCancel: ({ active }) =>
        t("library.dnd.dragCancel", { name: activeName(active.data.current) }),
    };
  }, [folders, notebooks, t]);

  const interaction = useLibraryInteractions({
    folders,
    notebooks,
    onMoveFolder: (folderId, parentId) => {
      void mutations.updateFolder(folderId, { parentId });
    },
    onMoveNotebook: (notebookId, folderId) => {
      void mutations.updateNotebook(notebookId, { folderId });
    },
  });

  const draftKey = draft ? `${draft.kind}:${draft.id}` : null;

  // Creates are optimistic: the card appears with a client id right away and
  // the inline rename is queued against the real id once the POST resolves.
  // The draft keeps the client id as its stable key across the temp-to-server
  // id swap, so the open rename editor survives the row being replaced. The
  // mutation reports the server id before it swaps the cached row, which keeps
  // that key stable on every intermediate render.
  const beginCreateFolder = () => {
    setSelectedKey(null);
    const { tempId, promise } = mutations.createFolder(
      { name: t("library.untitledFolder"), parentId: activeFolderId },
      (createdTempId, serverId) => {
        setDraft((current) =>
          current?.clientId === createdTempId ? { ...current, id: serverId } : current,
        );
      },
    );
    setDraft({ kind: "folder", id: tempId, clientId: tempId });
    void promise.then((serverId) => {
      if (!serverId) {
        setDraft((current) => (current?.clientId === tempId ? null : current));
      }
    });
  };

  const beginCreateNotebook = () => {
    setSelectedKey(null);
    const { tempId, promise } = mutations.createNotebook(
      { title: t("library.untitledNotebook"), folderId: activeFolderId },
      (createdTempId, serverId) => {
        setDraft((current) =>
          current?.clientId === createdTempId ? { ...current, id: serverId } : current,
        );
      },
    );
    setDraft({ kind: "notebook", id: tempId, clientId: tempId });
    void promise.then((serverId) => {
      if (!serverId) {
        setDraft((current) => (current?.clientId === tempId ? null : current));
      }
    });
  };

  const commitDraft = (name: string) => {
    if (!draft) return;
    const fallback =
      draft.kind === "folder" ? t("library.untitledFolder") : t("library.untitledNotebook");
    const nextName = clampTitle(name.trim()) || fallback;
    if (draft.kind === "folder") {
      void mutations.updateFolder(draft.id, { name: nextName });
    } else {
      void mutations.updateNotebook(draft.id, { title: nextName });
    }
    setDraft(null);
  };

  const cancelDraft = () => {
    if (!draft) return;
    if (draft.kind === "folder") {
      void mutations.deleteFolder(draft.id);
    } else {
      void mutations.deleteNotebook(draft.id);
    }
    setDraft(null);
  };

  const openFolder = (id: string | null) => {
    setSelectedKey(null);
    setActiveFolderId(id);
  };

  const removeFolder = (id: string) => {
    const parentId = folders.find((folder) => folder.id === id)?.parentId ?? null;
    if (activeFolderId === id) setActiveFolderId(parentId);
    void mutations.deleteFolder(id);
  };

  const requestRemoveNotebook = (id: string) => {
    const notebook = notebooks.find((item) => item.id === id);
    if (notebook) setPendingDelete(notebook);
  };

  const confirmRemoveNotebook = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setIsDeleting(true);
    if (draft?.id === id) setDraft(null);
    setSelectedKey((current) => (current === `notebook:${id}` ? null : current));
    await mutations.deleteNotebook(id);
    setIsDeleting(false);
    setPendingDelete(null);
  };

  const openNotebook = (id: string) => {
    void navigate({ to: "/notebooks/$notebookId", params: { notebookId: id } });
  };

  return (
    <div className="notebook-library flex flex-col">
      <LibraryHero onCreateNotebook={beginCreateNotebook} onCreateFolder={beginCreateFolder} />
      <DndContext
        sensors={interaction.sensors}
        collisionDetection={libraryCollisionDetection}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("library.dnd.instructions") },
        }}
        onDragStart={interaction.handleDragStart}
        onDragEnd={interaction.handleDragEnd}
        onDragCancel={interaction.cancelDrag}
      >
        <LibraryContent
          isLoading={isLoading}
          isError={isError}
          isRefetching={isRefetching}
          onRetry={() => void refetch()}
        >
          <FolderLibrary
            folders={folders}
            notebooks={notebooks}
            activeFolderId={activeFolderId}
            sortKey={sortKey}
            onSortChange={setSortKey}
            draftId={draft?.id ?? null}
            draftClientId={draft?.clientId ?? null}
            selectedKey={selectedKey ?? draftKey}
            onCommitDraft={commitDraft}
            onCancelDraft={cancelDraft}
            onSelectItem={setSelectedKey}
            onOpenFolder={openFolder}
            onRenameFolder={(id, name) => void mutations.updateFolder(id, { name })}
            onRemoveFolder={removeFolder}
            onRemoveNotebook={requestRemoveNotebook}
            onOpenNotebook={openNotebook}
            onUpdateNotebook={(id, patch) => void mutations.updateNotebook(id, patch)}
          />
        </LibraryContent>
        {/* dropAnimation={null}: snap the overlay onto the drop target instead
            of dnd-kit's default release animation, so a drop lands instantly. */}
        <DragOverlay dropAnimation={null}>
          {interaction.draggedNotebook ? (
            <NotebookPreview notebook={interaction.draggedNotebook} />
          ) : interaction.draggedFolder ? (
            <FolderPreview
              folder={interaction.draggedFolder}
              notebooks={interaction.draggedFolderNotebooks}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setPendingDelete(null);
        }}
        title={t("library.removeNotebook")}
        description={t("library.removeNotebookConfirm", { title: pendingDelete?.title ?? "" })}
        isLoading={isDeleting}
        onConfirm={() => void confirmRemoveNotebook()}
      />
    </div>
  );
}

function LibraryHero({
  onCreateNotebook,
  onCreateFolder,
}: {
  onCreateNotebook: () => void;
  onCreateFolder: () => void;
}) {
  const { t } = useTranslation("notebooks");
  return (
    <section className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-md font-heading text-2xl leading-snug font-semibold tracking-tight text-foreground">
          {t("library.heroTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("library.heroSubtitle")}</p>
      </div>
      <CreateMenu onCreateNotebook={onCreateNotebook} onCreateFolder={onCreateFolder} />
    </section>
  );
}

function LibraryContent({
  isLoading,
  isError,
  isRefetching,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("notebooks");
  if (isLoading) {
    return <LibraryGridSkeleton />;
  }
  if (isError) {
    return (
      <EmptyState
        icon={<CloudOff className="size-7 text-muted-foreground" />}
        title={t("library.loadFailedTitle")}
        description={t("library.loadFailedDescription")}
      >
        <Button onClick={onRetry} disabled={isRefetching} size="sm" className="cursor-pointer">
          {isRefetching ? <Spinner className="mr-2" /> : <RefreshCw className="mr-2 size-4" />}
          {t("library.retry")}
        </Button>
      </EmptyState>
    );
  }
  return <>{children}</>;
}
