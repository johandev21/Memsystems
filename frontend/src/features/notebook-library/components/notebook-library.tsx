import { useMemo, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CloudOff, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { libraryQueryOptions } from "../api/library";
import { useLibraryInteractions } from "../hooks/use-library-interactions";
import { useLibraryMutations } from "../hooks/use-library-mutations";
import { toLibraryNotebook } from "../model/adapters";
import type { LibrarySortKey } from "../model/library-sort";
import { clampTitle } from "../model/title";
import type { Draft } from "../model/types";
import { CreateMenu } from "./create-menu";
import { FolderLibrary } from "./folder-library";
import { FolderPreview, NotebookPreview } from "./library-cards";

export function NotebookLibrary() {
  const { t } = useTranslation("notebooks");
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery(libraryQueryOptions);
  const mutations = useLibraryMutations();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<LibrarySortKey>("name");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const folders = data?.folders ?? [];
  const notebooks = useMemo(
    () => (data?.notebooks ?? []).map(toLibraryNotebook),
    [data],
  );

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
  const beginCreateFolder = () => {
    setSelectedKey(null);
    const { tempId } = mutations.createFolder({
      name: t("library.untitledFolder"),
      parentId: activeFolderId,
    });
    setDraft({ kind: "folder", id: tempId });
  };

  const beginCreateNotebook = () => {
    setSelectedKey(null);
    const { tempId } = mutations.createNotebook({
      title: t("library.untitledNotebook"),
      folderId: activeFolderId,
    });
    setDraft({ kind: "notebook", id: tempId });
  };

  const commitDraft = (name: string) => {
    if (!draft) return;
    const fallback =
      draft.kind === "folder"
        ? t("library.untitledFolder")
        : t("library.untitledNotebook");
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

  const openNotebook = (id: string) => {
    void navigate({ to: "/notebooks/$notebookId", params: { notebookId: id } });
  };

  return (
    <div className="notebook-library flex flex-col">
      <LibraryHero
        onCreateNotebook={beginCreateNotebook}
        onCreateFolder={beginCreateFolder}
      />
      <DndContext
        sensors={interaction.sensors}
        collisionDetection={pointerWithin}
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
            selectedKey={selectedKey ?? draftKey}
            onCommitDraft={commitDraft}
            onCancelDraft={cancelDraft}
            onSelectItem={setSelectedKey}
            onOpenFolder={openFolder}
            onMoveNotebook={(id, folderId) => void mutations.updateNotebook(id, { folderId })}
            onMoveFolder={(id, parentId) => void mutations.updateFolder(id, { parentId })}
            onRenameFolder={(id, name) => void mutations.updateFolder(id, { name })}
            onRemoveFolder={removeFolder}
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
    return (
      <div className="library-grid py-2" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-42 w-59.75 rounded-[16px]" />
        ))}
      </div>
    );
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
