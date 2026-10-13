import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Eye,
  FolderInput,
  Pencil,
  Trash2,
} from "lucide-react";
import { createElement, useState, type ElementType } from "react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { FolderDTO } from "../../types";
import type { TreeNode } from "../model/tree";
import { getTreeIcon } from "../ui/tree/row-icon";
import { MobileMoveFolderPicker } from "./mobile-move-folder-picker";

const ACTION_CLASS =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium active:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer [@media(hover:hover)]:hover:bg-muted";

export interface MobileMaterialActionDrawerProps {
  material: TreeNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allFolders?: readonly FolderDTO[];
  canMove?: (draggedItemId: string, targetFolderId: string | null) => boolean;
  onView?: () => void;
  onBeginRename?: () => void;
  onDuplicate?: () => void;
  onMove?: (targetFolderId: string | null) => void;
  onDelete?: () => void;
}

export function MobileMaterialActionDrawer({
  material,
  open,
  onOpenChange,
  allFolders,
  canMove,
  onView,
  onBeginRename,
  onDuplicate,
  onMove,
  onDelete,
}: MobileMaterialActionDrawerProps) {
  const { t } = useTranslation(["tree", "viewer"]);
  const [isMoving, setIsMoving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsMoving(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSelectAction = (action?: () => void) => {
    onOpenChange(false);
    action?.();
  };

  const handleSelectMoveTarget = (folderId: string | null) => {
    setIsMoving(false);
    onOpenChange(false);
    onMove?.(folderId);
  };

  if (!material) return null;

  const validTargetFolders = (allFolders ?? []).filter((f) =>
    canMove ? canMove(material.id, f.id) : f.id !== material.parentId,
  );
  const canMoveToRoot = material.parentId !== null;
  const hasMoveTargets = canMoveToRoot || validTargetFolders.length > 0;
  const icon = getTreeIcon(material, false);
  const kindLabel = material.materialKind
    ? t(`viewer:kinds.${material.materialKind}`, material.materialKind)
    : undefined;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[85vh] p-4 pb-safe-lg">
        {isMoving ? (
          <>
            <DrawerHeader className="pb-3 text-left">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMoving(false)}
                  aria-label={t("actions.collapse", "Back")}
                  className="flex size-11 items-center justify-center rounded-lg text-muted-foreground active:scale-97 transition-transform touch-manipulation cursor-pointer"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="truncate text-base font-semibold">
                    {t("actions.moveToFolder", "Move to folder")}
                  </DrawerTitle>
                  <DrawerDescription className="truncate text-xs">{material.name}</DrawerDescription>
                </div>
              </div>
            </DrawerHeader>
            <MobileMoveFolderPicker
              folders={validTargetFolders}
              canMoveToRoot={canMoveToRoot}
              onSelect={handleSelectMoveTarget}
            />
          </>
        ) : (
          <>
            <DrawerHeader className="pb-2 text-left">
              <div className="flex min-w-0 items-center gap-2.5">
                {createElement(icon, {
                  className: "size-5 shrink-0 text-muted-foreground",
                  strokeWidth: 1.7,
                })}
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="truncate text-base font-semibold">
                    {material.name}
                  </DrawerTitle>
                  {kindLabel && (
                    <DrawerDescription className="truncate text-xs text-muted-foreground">
                      {kindLabel}
                    </DrawerDescription>
                  )}
                </div>
              </div>
            </DrawerHeader>

            <div className="flex flex-col gap-1 py-2">
              <ActionRow
                slot="mobile-material-action-view"
                icon={Eye}
                label={t("tree:defaults.studyMaterial", "View material")}
                onClick={() => handleSelectAction(onView)}
              />
              <ActionRow
                slot="mobile-material-action-rename"
                icon={Pencil}
                label={t("actions.rename", "Rename")}
                onClick={() => handleSelectAction(onBeginRename)}
              />
              <ActionRow
                slot="mobile-material-action-duplicate"
                icon={Copy}
                label={t("actions.duplicate", "Duplicate")}
                onClick={() => handleSelectAction(onDuplicate)}
              />
              {hasMoveTargets && (
                <button
                  type="button"
                  data-slot="mobile-material-action-move"
                  onClick={() => setIsMoving(true)}
                  className={ACTION_CLASS}
                >
                  <FolderInput className="size-4.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-left">{t("actions.moveToFolder", "Move to folder")}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              )}
              <ActionRow
                slot="mobile-material-action-delete"
                icon={Trash2}
                label={t("actions.delete", "Delete")}
                destructive
                onClick={() => handleSelectAction(onDelete)}
              />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  destructive = false,
  slot,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  slot?: string;
}) {
  return (
    <button
      type="button"
      data-slot={slot}
      onClick={onClick}
      className={`${ACTION_CLASS} ${
        destructive
          ? "text-destructive active:bg-destructive/10 [@media(hover:hover)]:hover:bg-destructive/10"
          : "text-foreground"
      }`}
    >
      <Icon className={`size-4.5 shrink-0 ${destructive ? "text-destructive" : "text-muted-foreground"}`} />
      <span className="truncate">{label}</span>
    </button>
  );
}
