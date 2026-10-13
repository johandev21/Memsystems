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
import type { SourceFolder } from "../../types/source-folder.types";
import { MobileMoveFolderPicker } from "./mobile-move-folder-picker";

const ACTION_CLASS =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium active:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer [@media(hover:hover)]:hover:bg-muted";

export interface MobileFolderActionDrawerProps {
  folder: SourceFolder | null;
  allFolders: readonly SourceFolder[];
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
                slot="mobile-folder-action-subfolder"
                icon={FolderPlus}
                label={t("actions.newSubfolder", "New subfolder")}
                onClick={() => run(onCreateSubfolder)}
              />
              {hasMoveTargets && (
                <ActionButton
                  slot="mobile-folder-action-move"
                  icon={FolderInput}
                  label={t("actions.moveToFolder", "Move to folder")}
                  trailing={<ChevronRight className="size-4 text-muted-foreground" />}
                  onClick={() => setIsMoving(true)}
                />
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
  slot,
  icon: Icon,
  label,
  trailing,
  destructive = false,
  onClick,
}: {
  slot: string;
  icon: ElementType;
  label: string;
  trailing?: React.ReactNode;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-slot={slot}
      onClick={onClick}
      className={`${ACTION_CLASS} ${destructive ? "text-destructive" : "text-foreground"} ${trailing ? "justify-between" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-4.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {trailing}
    </button>
  );
}
