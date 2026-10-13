import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Source } from "../../api/sources";
import type { PendingSourceUpload } from "../../hooks/use-upload-store";
import type { SourcesTreeNode } from "../../model/sources-tree";
import type { SourceFolder } from "../../types/source-folder.types";
import { MobileCreatePromptDrawer } from "@/components/ui/mobile-create-prompt-drawer";
import { AddSourceDialog } from "../add-source-dialog";
import { MobileSourceActionDrawer } from "../mobile-source-action-drawer";
import { PendingUploadRow } from "../pending-upload-row";
import { MobileFolderActionDrawer } from "./mobile-folder-action-drawer";
import { MobileFolderTile } from "./mobile-folder-tile";
import { MobileRenameSheet } from "./mobile-rename-sheet";
import { MobileSourceCreateDrawer } from "./mobile-source-create-drawer";
import { MobileSourceTile } from "./mobile-source-tile";
import { MobileSourcesHeader } from "./mobile-sources-header";
import { useMobileSourcesNavigation } from "./use-mobile-sources-navigation";

export interface MobileSourcesViewProps {
  notebookId: string;
  sources: Source[] | undefined;
  folders: SourceFolder[] | undefined;
  pendingUploads: PendingSourceUpload[];
  isPending: boolean;
  isError: boolean;
  onRetryLoad: () => void;
  onSelectSource: (id: string) => void;
  onCancelPendingUpload: (id: string) => void;
  canMove: (itemId: string, targetFolderId: string | null) => boolean;
  onMove: (itemId: string, targetFolderId: string | null) => void;
  onCreateFolder: (parentId: string | null, name?: string) => void;
  onDeleteFolder: (id: string) => void;
  onDeleteSource: (source: Source) => void;
  onRetrySource: (source: Source) => void;
  onCancelSource: (source: Source) => void;
  deletingId?: string;
  retryingId?: string;
  cancellingId?: string;
  editingItemId: string | null;
  onBeginRename: (id: string) => void;
  onRenameCommit: (id: string, name: string) => void;
  onRenameCancel: () => void;
}

export function MobileSourcesView(props: MobileSourcesViewProps) {
  const { t } = useTranslation(["tree", "notebooks"]);
  const { notebookId, sources, folders, pendingUploads, isPending, isError } = props;
  const navigation = useMobileSourcesNavigation(folders, sources);
  const [actionSourceId, setActionSourceId] = useState<string | null>(null);
  const [actionFolderId, setActionFolderId] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<SourceFolder | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [addSourceDialogOpen, setAddSourceDialogOpen] = useState(false);
  const [createFolderTargetParentId, setCreateFolderTargetParentId] = useState<
    string | null | undefined
  >(undefined);

  const actionSource = sources?.find((source) => source.id === actionSourceId) ?? null;
  const actionFolder = folders?.find((folder) => folder.id === actionFolderId) ?? null;
  const renaming = findRenameTarget(props.editingItemId, sources, folders);
  const showPendingUploads = navigation.activeFolderId === null && pendingUploads.length > 0;
  const isEmpty = navigation.items.length === 0 && !showPendingUploads;

  return (
    <div className="relative flex h-full min-w-0 flex-col bg-background">
      <MobileSourcesHeader
        folderName={navigation.activeFolderName}
        onBack={navigation.goBack}
      />

      <div
        data-slot="sources-panel-content"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-28 pt-2"
      >
        {showPendingUploads && (
          <div className="mb-2 flex flex-col gap-2">
            {pendingUploads.map((upload) => (
              <PendingUploadRow
                key={upload.id}
                upload={upload}
                onCancel={props.onCancelPendingUpload}
              />
            ))}
          </div>
        )}

        {isPending ? (
          <SourcesLoadingState />
        ) : isError ? (
          <SourcesErrorState onRetry={props.onRetryLoad} />
        ) : isEmpty ? (
          <SourcesEmptyState
            inFolder={navigation.activeFolderId !== null}
            onAddSource={() => setAddSourceDialogOpen(true)}
          />
        ) : (
          <div
            key={navigation.activeFolderId ?? "root"}
            role="list"
            className={`flex flex-col gap-0.5 animate-in fade-in duration-200 ease-out motion-reduce:animate-none ${
              navigation.direction === "forward"
                ? "slide-in-from-right-4"
                : "slide-in-from-left-4"
            }`}
          >
            {navigation.items.map((node) => (
              <SourcesTreeTile
                key={node.id}
                node={node}
                onOpenFolder={navigation.openFolder}
                onOpenSource={props.onSelectSource}
                onSourceActions={setActionSourceId}
                onFolderActions={setActionFolderId}
              />
            ))}
          </div>
        )}
      </div>

      <AddSourceFab onOpen={() => setCreateDrawerOpen(true)} />

      <MobileSourceCreateDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        onAddSource={() => setAddSourceDialogOpen(true)}
        onCreateFolder={() => {
          setCreateDrawerOpen(false);
          setCreateFolderTargetParentId(navigation.activeFolderId);
        }}
      />

      <AddSourceDialog
        notebookId={notebookId}
        open={addSourceDialogOpen}
        onOpenChange={setAddSourceDialogOpen}
        forceDrawer
      />

      <MobileSourceActionDrawer
        source={actionSource ?? placeholderSource}
        open={actionSource !== null}
        onOpenChange={(open) => !open && setActionSourceId(null)}
        allFolders={folders}
        canMove={props.canMove}
        onViewContent={() => actionSource && props.onSelectSource(actionSource.id)}
        onBeginRename={() => actionSource && props.onBeginRename(actionSource.id)}
        onMove={(targetId) => actionSource && props.onMove(actionSource.id, targetId)}
        onDelete={() => actionSource && props.onDeleteSource(actionSource)}
        onRetry={() => actionSource && props.onRetrySource(actionSource)}
        onCancel={() => actionSource && props.onCancelSource(actionSource)}
        deleting={props.deletingId === actionSource?.id}
        retrying={props.retryingId === actionSource?.id}
        cancelling={props.cancellingId === actionSource?.id}
      />

      <MobileFolderActionDrawer
        folder={actionFolder}
        allFolders={folders ?? []}
        canMove={props.canMove}
        onOpenChange={(open) => !open && setActionFolderId(null)}
        onRename={props.onBeginRename}
        onCreateSubfolder={(parentId) => {
          setActionFolderId(null);
          setCreateFolderTargetParentId(parentId);
        }}
        onMove={props.onMove}
        onDelete={(id) => setFolderToDelete(folders?.find((f) => f.id === id) ?? null)}
      />

      <MobileCreatePromptDrawer
        open={createFolderTargetParentId !== undefined}
        onOpenChange={(open) => {
          if (!open) setCreateFolderTargetParentId(undefined);
        }}
        title={t("notebooks:library.create.newFolder", "New folder")}
        placeholder={t("notebooks:library.create.folderPlaceholder", "Folder name")}
        submitLabel={t("tree:actions.create", "Create")}
        cancelLabel={t("tree:actions.cancel", "Cancel")}
        onConfirm={(name) => {
          props.onCreateFolder(createFolderTargetParentId ?? null, name);
          setCreateFolderTargetParentId(undefined);
        }}
      />

      <MobileRenameSheet
        open={renaming !== null}
        initialValue={renaming?.name ?? ""}
        onCommit={(name) => renaming && props.onRenameCommit(renaming.id, name)}
        onCancel={props.onRenameCancel}
      />

      <FolderDeleteConfirmation
        folder={folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={props.onDeleteFolder}
      />
    </div>
  );
}

function SourcesTreeTile({
  node,
  onOpenFolder,
  onOpenSource,
  onSourceActions,
  onFolderActions,
}: {
  node: SourcesTreeNode;
  onOpenFolder: (id: string) => void;
  onOpenSource: (id: string) => void;
  onSourceActions: (id: string) => void;
  onFolderActions: (id: string) => void;
}) {
  if (node.type === "source" && node.source) {
    return (
      <MobileSourceTile
        source={node.source}
        onOpen={() => onOpenSource(node.id)}
        onActions={() => onSourceActions(node.id)}
      />
    );
  }

  return (
    <MobileFolderTile
      name={node.name}
      itemCount={node.children.length}
      onOpen={() => onOpenFolder(node.id)}
      onActions={() => onFolderActions(node.id)}
    />
  );
}

function AddSourceFab({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation("sources");

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end px-4 pb-safe-lg">
      <button
        type="button"
        data-slot="mobile-add-source-fab"
        onClick={onOpen}
        aria-label={t("mobile.addSource", "Add source")}
        className="pointer-events-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 touch-manipulation"
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}

function FolderDeleteConfirmation({
  folder,
  onClose,
  onConfirm,
}: {
  folder: SourceFolder | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  const { t } = useTranslation("tree");

  return (
    <ConfirmDeleteDialog
      open={folder !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("deleteDialog.folderTitle", "Delete folder")}
      description={t("deleteDialog.description", { name: folder?.name ?? "" })}
      onConfirm={() => {
        if (folder) onConfirm(folder.id);
        onClose();
      }}
    />
  );
}

function SourcesLoadingState() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex min-h-14 items-center gap-3 px-3">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

function SourcesErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("sources");

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-destructive">{t("sourcesList.failedToLoad")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-medium text-foreground active:bg-muted touch-manipulation"
      >
        {t("sourcesList.retry", "Retry")}
      </button>
    </div>
  );
}

function SourcesEmptyState({
  inFolder,
  onAddSource,
}: {
  inFolder: boolean;
  onAddSource: () => void;
}) {
  const { t } = useTranslation("sources");

  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">
        {inFolder ? t("mobile.emptyFolderTitle") : t("sourcesList.emptyTitle")}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {inFolder ? t("mobile.emptyFolderDescription") : t("sourcesList.emptyDescription")}
      </p>
      <button
        type="button"
        onClick={onAddSource}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform active:scale-97 touch-manipulation cursor-pointer"
      >
        {t("mobile.addSource", "Add source")}
      </button>
    </div>
  );
}

function findRenameTarget(
  editingItemId: string | null,
  sources: Source[] | undefined,
  folders: SourceFolder[] | undefined,
): { id: string; name: string } | null {
  if (!editingItemId) return null;
  const folder = folders?.find((f) => f.id === editingItemId);
  if (folder) return { id: folder.id, name: folder.name };
  const source = sources?.find((s) => s.id === editingItemId);
  return source ? { id: source.id, name: source.title } : null;
}

const placeholderSource = {
  id: "",
  title: "",
  folderId: null,
} as unknown as Source;
