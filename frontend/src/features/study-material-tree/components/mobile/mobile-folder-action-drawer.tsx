import { ArrowLeft, ChevronRight, Folder, FolderInput, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useState, type ElementType } from "react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { FolderDTO } from "../../types";
import { MobileMoveFolderPicker } from "./mobile-move-folder-picker";

const ACTION_CLASS =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium active:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer [@media(hover:hover)]:hover:bg-muted";

export interface MobileFolderActionDrawerProps {
  folder: FolderDTO | null;
  allFolders: readonly FolderDTO[];
  canMove: (draggedItemId: string, targetFolderId: string | null) => boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (folderId: string) => void;
  onCreateSubfolder: (folderId: string) => void;
  onMove: (folderId: string, targetFolderId: string | null) => void;
  onDelete: (folderId: string) => void;
}

export function MobileFolderActionDrawer({
  folder,
  allFolders,
  canMove,
  onOpenChange,
  onRename,
  onCreateSubfolder,
  onMove,
  onDelete,
}: MobileFolderActionDrawerProps) {
  const { t } = useTranslation("tree");
  const [isMoving, setIsMoving] = useState(false);

  const close = () => {
    setIsMoving(false);
    onOpenChange(false);
  };

  const run = (action: (folderId: string) => void) => {
    if (!folder) return;
    close();
    action(folder.id);
  };

  const targets = folder ? allFolders.filter((candidate) => canMove(folder.id, candidate.id)) : [];
  const canMoveToRoot = folder ? folder.parentId !== null : false;
  const hasMoveTargets = canMoveToRoot || targets.length > 0;

  return (
    <Drawer open={folder !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DrawerContent className="max-h-[85vh] p-4 pb-safe-lg">
        {folder && isMoving ? (
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
                  <DrawerDescription className="truncate text-xs">{folder.name}</DrawerDescription>
                </div>
              </div>
            </DrawerHeader>
            <MobileMoveFolderPicker
              folders={targets}
              canMoveToRoot={canMoveToRoot}
              onSelect={(targetId) => {
                close();
                onMove(folder.id, targetId);
              }}
            />
          </>
        ) : folder ? (
          <>
            <DrawerHeader className="pb-2 text-left">
              <div className="flex min-w-0 items-center gap-2.5">
                <Folder className="size-5 shrink-0 text-primary/70" strokeWidth={1.7} />
                <DrawerTitle className="truncate text-base font-semibold">{folder.name}</DrawerTitle>
              </div>
              <DrawerDescription className="sr-only">{folder.name}</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-1 py-2">
              <ActionButton
                slot="mobile-folder-action-rename"
                icon={Pencil}
                label={t("actions.rename", "Rename")}
                onClick={() => run(onRename)}
              />
              <ActionButton
                slot="mobile-folder-action-create-subfolder"
                icon={FolderPlus}
                label={t("actions.newSubfolder", "New subfolder")}
                onClick={() => run(onCreateSubfolder)}
              />
              {hasMoveTargets && (
                <button
                  type="button"
                  data-slot="mobile-folder-action-move"
                  onClick={() => setIsMoving(true)}
                  className={ACTION_CLASS}
                >
                  <FolderInput className="size-4.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-left">{t("actions.moveToFolder", "Move to folder")}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              )}
              <ActionButton
                slot="mobile-folder-action-delete"
                icon={Trash2}
                label={t("actions.delete", "Delete")}
                destructive
                onClick={() => run(onDelete)}
              />
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function ActionButton({
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
