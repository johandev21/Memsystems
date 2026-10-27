import type { ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  type CollisionDetection,
} from "@dnd-kit/core";
import { CloudOff, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDeleteDialog } from "@/shared/components/ui/confirm-delete-dialog";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Spinner } from "@/shared/components/ui/spinner";
import { useNotebookLibraryController } from "../hooks/use-notebook-library-controller";
import type { LibraryFolder, LibraryNotebook } from "../model/types";
import { CreateMenu } from "./create-menu";
import { FolderLibrary } from "./folder-library";
import { LibraryGridSkeleton } from "./library-skeleton";
import { FolderPreview, NotebookPreview } from "./library-cards";

const libraryCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

export function NotebookLibrary() {
  const { t } = useTranslation("notebooks");
  const {
    isLoading,
    isError,
    isRefetching,
    refetch,
    folders,
    notebooks,
    activeFolderId,
    sortKey,
    draft,
    selectedKey,
    setSelectedKey,
    pendingDelete,
    setPendingDelete,
    pendingFolderDelete,
    setPendingFolderDelete,
    isDeleting,
    announcements,
    interaction,
    handleExportNotebook,
    handleCreateFolderMobile,
    handleCreateNotebookMobile,
    importInputRef,
    handleTriggerImport,
    handleImportFileChange,
    beginCreateFolder,
    beginCreateNotebook,
    commitDraft,
    cancelDraft,
    openFolder,
    handleSortChange,
    requestRemoveFolder,
    confirmRemoveFolder,
    requestRemoveNotebook,
    confirmRemoveNotebook,
    openNotebook,
    mutations,
  } = useNotebookLibraryController();

  return (
    <div className="notebook-library flex flex-col w-full">
      <input
        ref={importInputRef}
        type="file"
        accept=".memsys,application/zip"
        className="hidden"
        onChange={(e) => void handleImportFileChange(e)}
      />
      <LibraryHero
        onCreateNotebook={beginCreateNotebook}
        onCreateFolder={beginCreateFolder}
        onImportNotebook={handleTriggerImport}
      />
      <DndContext
        sensors={interaction.sensors}
        collisionDetection={libraryCollisionDetection}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("library.dnd.instructions") },
        }}
        onDragStart={interaction.handleDragStart}
        onDragOver={interaction.handleDragOver}
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
            onSortChange={handleSortChange}
            draftId={draft?.id ?? null}
            draftClientId={draft?.clientId ?? null}
            selectedKey={selectedKey}
            onCommitDraft={commitDraft}
            onCancelDraft={cancelDraft}
            onSelectItem={setSelectedKey}
            onOpenFolder={openFolder}
            onRenameFolder={(id, name) => void mutations.updateFolder(id, { name })}
            onRemoveFolder={requestRemoveFolder}
            onRemoveNotebook={requestRemoveNotebook}
            onOpenNotebook={openNotebook}
            onUpdateNotebook={(id, patch) => void mutations.updateNotebook(id, patch)}
            onCreateFolder={beginCreateFolder}
            onCreateNotebook={beginCreateNotebook}
            onCreateFolderNamed={handleCreateFolderMobile}
            onCreateNotebookNamed={handleCreateNotebookMobile}
            onExportNotebook={handleExportNotebook}
            onImportNotebook={handleTriggerImport}
          />
        </LibraryContent>
        <LibraryDragOverlay
          notebook={interaction.draggedNotebook ?? null}
          folder={interaction.draggedFolder ?? null}
          folderNotebooks={interaction.draggedFolderNotebooks}
          compact={interaction.isPreviewCompact}
        />
      </DndContext>
      <LibraryDeleteDialogs
        notebook={pendingDelete}
        folder={pendingFolderDelete}
        isDeleting={isDeleting}
        onCloseNotebook={() => setPendingDelete(null)}
        onCloseFolder={() => setPendingFolderDelete(null)}
        onConfirmNotebook={() => void confirmRemoveNotebook()}
        onConfirmFolder={() => void confirmRemoveFolder()}
      />
    </div>
  );
}

function LibraryDragOverlay({
  notebook,
  folder,
  folderNotebooks,
  compact,
}: {
  notebook: LibraryNotebook | null;
  folder: LibraryFolder | null;
  folderNotebooks: LibraryNotebook[];
  compact: boolean;
}) {
  return (
    <DragOverlay dropAnimation={null}>
      {notebook ? (
        <NotebookPreview notebook={notebook} compact={compact} />
      ) : folder ? (
        <FolderPreview folder={folder} notebooks={folderNotebooks} compact={compact} />
      ) : null}
    </DragOverlay>
  );
}

function LibraryDeleteDialogs({
  notebook,
  folder,
  isDeleting,
  onCloseNotebook,
  onCloseFolder,
  onConfirmNotebook,
  onConfirmFolder,
}: {
  notebook: LibraryNotebook | null;
  folder: LibraryFolder | null;
  isDeleting: boolean;
  onCloseNotebook: () => void;
  onCloseFolder: () => void;
  onConfirmNotebook: () => void;
  onConfirmFolder: () => void;
}) {
  const { t } = useTranslation("notebooks");
  return (
    <>
      <ConfirmDeleteDialog
        open={notebook !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) onCloseNotebook();
        }}
        title={t("library.removeNotebook")}
        description={t("library.removeNotebookConfirm", { title: notebook?.title ?? "" })}
        isLoading={isDeleting}
        onConfirm={onConfirmNotebook}
      />
      <ConfirmDeleteDialog
        open={folder !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) onCloseFolder();
        }}
        title={t("library.removeFolder")}
        description={t("library.removeFolderConfirm", { name: folder?.name ?? "" })}
        isLoading={isDeleting}
        onConfirm={onConfirmFolder}
      />
    </>
  );
}

function LibraryHero({
  onCreateNotebook,
  onCreateFolder,
  onImportNotebook,
}: {
  onCreateNotebook: () => void;
  onCreateFolder: () => void;
  onImportNotebook?: () => void;
}) {
  const { t } = useTranslation("notebooks");
  return (
    <section className="hidden sm:flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between w-full">
      <div className="flex flex-col gap-2">
        <h1 className="max-w-md font-heading text-2xl leading-snug font-semibold tracking-tight text-foreground">
          {t("library.heroTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("library.heroSubtitle")}</p>
      </div>
      <CreateMenu
        onCreateNotebook={onCreateNotebook}
        onCreateFolder={onCreateFolder}
        onImportNotebook={onImportNotebook}
      />
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
