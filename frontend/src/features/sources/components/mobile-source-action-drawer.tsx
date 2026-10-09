import {
  ArrowLeft,
  ChevronRight,
  Eye,
  Folder,
  FolderInput,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Source } from "../api/sources";
import type { SourceFolder } from "../types/source-folder.types";
import { SourceIcon } from "./sources-list/source-icon";
import {
  isSourceProcessing,
  processingStageLabel,
  sourceProcessingStatus,
} from "../utils/source-processing";

export interface MobileSourceActionDrawerProps {
  source: Source;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allFolders?: readonly SourceFolder[];
  canMove?: (draggedItemId: string, targetFolderId: string | null) => boolean;
  onViewContent?: () => void;
  onBeginRename?: () => void;
  onMove?: (targetFolderId: string | null) => void;
  onDelete?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  deleting?: boolean;
  retrying?: boolean;
  cancelling?: boolean;
}

export function MobileSourceActionDrawer({
  source,
  open,
  onOpenChange,
  allFolders,
  canMove,
  onViewContent,
  onBeginRename,
  onMove,
  onDelete,
  onRetry,
  onCancel,
  deleting = false,
  retrying = false,
  cancelling = false,
}: MobileSourceActionDrawerProps) {
  const { t } = useTranslation(["sources", "tree"]);
  const [isMoving, setIsMoving] = useState(false);

  const status = sourceProcessingStatus(source);
  const active = isSourceProcessing(source);
  const failed = status === "failed";
  const statusLabel = processingStageLabel(status, source.processingStage, source.modality);

  const validTargetFolders = (allFolders ?? []).filter((f) =>
    canMove ? canMove(source.id, f.id) : f.id !== source.folderId,
  );
  const canMoveToRoot = source.folderId !== null;
  const hasMoveTargets = canMoveToRoot || validTargetFolders.length > 0;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsMoving(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSelectAction = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const handleSelectMoveTarget = (folderId: string | null) => {
    setIsMoving(false);
    onOpenChange(false);
    onMove?.(folderId);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="p-4 pb-safe-lg max-h-[85vh]">
        {isMoving ? (
          <>
            <DrawerHeader className="pb-3 text-left">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMoving(false)}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-97 transition-transform touch-manipulation cursor-pointer"
                  aria-label={t("tree:actions.collapse", "Back")}
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="text-base font-semibold truncate">
                    {t("tree:actions.moveToFolder", "Move to folder")}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs truncate">
                    {source.title}
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex flex-col gap-1 py-1 max-h-[60vh] overflow-y-auto">
              {canMoveToRoot && (
                <button
                  type="button"
                  data-slot="mobile-move-target-root"
                  onClick={() => handleSelectMoveTarget(null)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer"
                >
                  <FolderInput className="size-4.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {t("tree:actions.moveToSourcesRoot", "Move to Sources root")}
                  </span>
                </button>
              )}

              {validTargetFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  data-slot={`mobile-move-target-${folder.id}`}
                  onClick={() => handleSelectMoveTarget(folder.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer"
                >
                  <Folder className="size-4.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}

              {!hasMoveTargets && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {t("tree:tree.emptyDescription", "No folders available")}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <DrawerHeader className="pb-2 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <SourceIcon source={source} className="size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="text-base font-semibold truncate">
                    {source.title}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs truncate">
                    {statusLabel}
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <div className="flex flex-col gap-1 py-2">
              <button
                type="button"
                data-slot="mobile-source-action-view"
                onClick={() => handleSelectAction(() => onViewContent?.())}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer"
              >
                <Eye className="size-4.5 text-muted-foreground shrink-0" />
                <span>{t("sources:actions.viewContent", "View content")}</span>
              </button>

              <button
                type="button"
                data-slot="mobile-source-action-rename"
                onClick={() => handleSelectAction(() => onBeginRename?.())}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer"
              >
                <Pencil className="size-4.5 text-muted-foreground shrink-0" />
                <span>{t("tree:actions.rename", "Rename")}</span>
              </button>

              {hasMoveTargets && (
                <button
                  type="button"
                  data-slot="mobile-source-action-move"
                  onClick={() => setIsMoving(true)}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FolderInput className="size-4.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{t("tree:actions.moveToFolder", "Move to folder")}</span>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              )}

              {failed && onRetry && (
                <button
                  type="button"
                  data-slot="mobile-source-action-retry"
                  onClick={() => handleSelectAction(onRetry)}
                  disabled={retrying}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer"
                >
                  {retrying ? (
                    <Loader2 className="size-4.5 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <RotateCcw className="size-4.5 text-muted-foreground shrink-0" />
                  )}
                  <span>{t("sources:sourceRow.retryProcessing", "Retry processing")}</span>
                </button>
              )}

              {active && onCancel && (
                <button
                  type="button"
                  data-slot="mobile-source-action-cancel"
                  onClick={() => handleSelectAction(onCancel)}
                  disabled={cancelling}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer"
                >
                  {cancelling ? (
                    <Loader2 className="size-4.5 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <X className="size-4.5 text-muted-foreground shrink-0" />
                  )}
                  <span>{t("sources:pendingUpload.cancelProcessing", "Cancel")}</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  data-slot="mobile-source-action-delete"
                  onClick={() => handleSelectAction(onDelete)}
                  disabled={deleting}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-98 transition-transform touch-manipulation cursor-pointer"
                >
                  {deleting ? (
                    <Loader2 className="size-4.5 animate-spin shrink-0" />
                  ) : (
                    <Trash2 className="size-4.5 shrink-0" />
                  )}
                  <span>{t("sources:sourceRow.delete", "Delete")}</span>
                </button>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
