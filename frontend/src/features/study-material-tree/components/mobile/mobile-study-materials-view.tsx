import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { FolderDTO } from "../../types";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";
import { canMoveItem, type TreeNode } from "../model/tree";
import type { TreeCommandExecutor } from "../model/commands";
import { MobileCreatePromptDrawer } from "@/components/ui/mobile-create-prompt-drawer";
import { MobileFolderActionDrawer } from "./mobile-folder-action-drawer";
import { MobileFolderTile } from "./mobile-folder-tile";
import { MobileMaterialActionDrawer } from "./mobile-material-action-drawer";
import { MobileMaterialTile } from "./mobile-material-tile";
import { MobileRenameSheet } from "./mobile-rename-sheet";
import { MobileStudyMaterialsHeader } from "./mobile-study-materials-header";
import { useMobileStudyMaterialsNavigation } from "./use-mobile-study-materials-navigation";
import { Folder } from "lucide-react";

export interface MobileStudyMaterialsViewProps {
  notebookId: string;
  folders: readonly FolderDTO[] | undefined;
  materials: readonly StudyMaterialDTO[] | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetryLoad: () => void;
  onSelectMaterial: (materialId: string | null) => void;
  onCommand: TreeCommandExecutor;
}

export function MobileStudyMaterialsView({
  folders,
  materials,
  isPending,
  isError,
  errorMessage,
  onRetryLoad,
  onSelectMaterial,
  onCommand,
}: MobileStudyMaterialsViewProps) {
  const { t } = useTranslation(["tree", "notebooks"]);
  const navigation = useMobileStudyMaterialsNavigation(folders, materials);
  const [actionMaterialId, setActionMaterialId] = useState<string | null>(null);
  const [actionFolderId, setActionFolderId] = useState<string | null>(null);
  const [renamingTarget, setRenamingTarget] = useState<{ id: string; name: string } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TreeNode | null>(null);
  const [createFolderTargetParentId, setCreateFolderTargetParentId] = useState<
    string | null | undefined
  >(undefined);

  const actionMaterial =
    navigation.items.find((item) => item.id === actionMaterialId && item.type === "material") ??
    findInTree(navigation.items, actionMaterialId);

  const actionFolder =
    folders?.find((folder) => folder.id === actionFolderId) ?? null;

  const canMove = useCallback(
    (itemId: string, targetFolderId: string | null) => {
      return canMoveItem(
        { folders: folders ?? [], materials: materials ?? [] },
        itemId,
        targetFolderId,
      );
    },
    [folders, materials],
  );

  const handleCreateFolder = useCallback(
    (parentId: string | null, name?: string) => {
      void onCommand({ type: "createFolder", parentId, name });
    },
    [onCommand],
  );

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ parentId?: string | null }>).detail;
      const targetParentId = detail?.parentId !== undefined ? detail.parentId : navigation.activeFolderId;
      setCreateFolderTargetParentId(targetParentId);
    };
    window.addEventListener("create-study-material-folder", handleEvent);
    return () => window.removeEventListener("create-study-material-folder", handleEvent);
  }, [navigation.activeFolderId]);

  const handleRenameCommit = useCallback(
    (name: string) => {
      if (renamingTarget) {
        void onCommand({ type: "renameItem", id: renamingTarget.id, name });
        setRenamingTarget(null);
      }
    },
    [renamingTarget, onCommand],
  );

  const handleMove = useCallback(
    (itemId: string, targetFolderId: string | null) => {
      void onCommand({ type: "moveItem", id: itemId, targetFolderId });
    },
    [onCommand],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      void onCommand({ type: "duplicateMaterial", id });
    },
    [onCommand],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (itemToDelete) {
      void onCommand({ type: "deleteItem", id: itemToDelete.id });
      setItemToDelete(null);
    }
  }, [itemToDelete, onCommand]);

  const isEmpty = navigation.items.length === 0;

  return (
    <div
      data-slot="mobile-study-materials-view"
      className="relative flex flex-col min-w-0 bg-background"
    >
      <MobileStudyMaterialsHeader
        folderName={navigation.activeFolderName}
        onBack={navigation.goBack}
        onCreateFolder={() => setCreateFolderTargetParentId(navigation.activeFolderId)}
      />

      <div
        data-slot="study-materials-content"
        className="min-h-0 flex-1 px-2 pb-28 pt-1"
      >
        {isPending ? (
          <StudyMaterialsLoadingState />
        ) : isError ? (
          <StudyMaterialsErrorState message={errorMessage} onRetry={onRetryLoad} />
        ) : isEmpty ? (
          <StudyMaterialsEmptyState inFolder={navigation.activeFolderId !== null} />
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
              <StudyMaterialTreeTile
                key={node.id}
                node={node}
                onOpenFolder={navigation.openFolder}
                onOpenMaterial={onSelectMaterial}
                onMaterialActions={setActionMaterialId}
                onFolderActions={setActionFolderId}
              />
            ))}
          </div>
        )}
      </div>

      <MobileMaterialActionDrawer
        material={actionMaterial ?? null}
        open={actionMaterialId !== null}
        onOpenChange={(open) => !open && setActionMaterialId(null)}
        allFolders={folders}
        canMove={canMove}
        onView={() => actionMaterial && onSelectMaterial(actionMaterial.id)}
        onBeginRename={() =>
          actionMaterial && setRenamingTarget({ id: actionMaterial.id, name: actionMaterial.name })
        }
        onDuplicate={() => actionMaterial && handleDuplicate(actionMaterial.id)}
        onMove={(targetFolderId) => actionMaterial && handleMove(actionMaterial.id, targetFolderId)}
        onDelete={() => actionMaterial && setItemToDelete(actionMaterial)}
      />

      <MobileFolderActionDrawer
        folder={actionFolder}
        allFolders={folders ?? []}
        canMove={canMove}
        onOpenChange={(open) => !open && setActionFolderId(null)}
        onRename={(id) => {
          const folder = folders?.find((f) => f.id === id);
          if (folder) setRenamingTarget({ id: folder.id, name: folder.name });
        }}
        onCreateSubfolder={(folderId) => {
          setActionFolderId(null);
          setCreateFolderTargetParentId(folderId);
        }}
        onMove={handleMove}
        onDelete={(id) => {
          const node = navigation.items.find((item) => item.id === id);
          if (node) setItemToDelete(node);
        }}
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
          handleCreateFolder(createFolderTargetParentId ?? null, name);
          setCreateFolderTargetParentId(undefined);
        }}
      />

      <MobileRenameSheet
        open={renamingTarget !== null}
        initialValue={renamingTarget?.name ?? ""}
        onCommit={handleRenameCommit}
        onCancel={() => setRenamingTarget(null)}
      />

      <ItemDeleteConfirmation
        item={itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function StudyMaterialTreeTile({
  node,
  onOpenFolder,
  onOpenMaterial,
  onMaterialActions,
  onFolderActions,
}: {
  node: TreeNode;
  onOpenFolder: (id: string) => void;
  onOpenMaterial: (id: string) => void;
  onMaterialActions: (id: string) => void;
  onFolderActions: (id: string) => void;
}) {
  if (node.type === "material") {
    return (
      <MobileMaterialTile
        node={node}
        onOpen={() => onOpenMaterial(node.id)}
        onActions={() => onMaterialActions(node.id)}
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

function ItemDeleteConfirmation({
  item,
  onClose,
  onConfirm,
}: {
  item: TreeNode | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("tree");

  return (
    <ConfirmDeleteDialog
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title={
        item?.type === "folder"
          ? t("deleteDialog.folderTitle", "Delete folder")
          : t("deleteDialog.materialTitle", "Delete study material")
      }
      description={
        item?.type === "folder"
          ? t("deleteDialog.folderDescription", { name: item.name })
          : t("deleteDialog.description", { name: item?.name ?? "" })
      }
      onConfirm={onConfirm}
    />
  );
}

function StudyMaterialsLoadingState() {
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

function StudyMaterialsErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation("tree");

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-xs text-destructive">{message ?? t("errors.loadFailed")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-medium text-primary underline underline-offset-4 touch-manipulation active:scale-97 cursor-pointer"
      >
        {t("errors.retry")}
      </button>
    </div>
  );
}

function StudyMaterialsEmptyState({ inFolder }: { inFolder: boolean }) {
  const { t } = useTranslation("tree");

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
      <Folder className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">
        {inFolder ? t("tree.emptyFolder", "This folder is empty") : t("tree.emptyTitle", "No study materials")}
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {inFolder
          ? t("tree.emptyFolderDescription", "Move materials here or tap + to generate new ones.")
          : t("tree.mobileEmptyDescription", "Tap + to generate a quiz, flashcards, or slides.")}
      </p>
    </div>
  );
}

function findInTree(nodes: readonly TreeNode[], id: string | null): TreeNode | null {
  if (!id) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findInTree(node.children, id);
    if (found) return found;
  }
  return null;
}
