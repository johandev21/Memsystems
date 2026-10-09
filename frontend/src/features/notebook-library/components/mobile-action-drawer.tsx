import { FolderInput, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { LibraryItem } from "../model/library-sort";

export interface MobileActionDrawerProps {
  item: LibraryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onStartRename: () => void;
  onStartMove: () => void;
  onDelete: () => void;
}

export function MobileActionDrawer({
  item,
  isOpen,
  onClose,
  onStartRename,
  onStartMove,
  onDelete,
}: MobileActionDrawerProps) {
  const { t } = useTranslation("notebooks");
  if (!item) return null;

  const itemName = item.kind === "folder" ? item.folder.name : item.notebook.title;
  const itemType = item.kind === "folder" ? t("library.folder") : t("library.notebook");
  const deleteLabel =
    item.kind === "folder" ? t("library.removeFolder") : t("library.removeNotebook");

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent className="p-4 pb-safe-lg">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-base font-semibold truncate">{itemName}</DrawerTitle>
          <DrawerDescription className="text-xs">{itemType}</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-1 py-2">
          <button
            type="button"
            onClick={onStartRename}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-95 transition-transform transition-colors touch-manipulation cursor-pointer"
          >
            <Pencil className="size-4 text-muted-foreground" />
            <span>{t("library.rename")}</span>
          </button>

          {item.kind === "notebook" && (
            <button
              type="button"
              onClick={onStartMove}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted active:scale-95 transition-transform transition-colors touch-manipulation cursor-pointer"
            >
              <FolderInput className="size-4 text-muted-foreground" />
              <span>{t("library.moveToFolder", "Move to folder")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-95 transition-transform transition-colors touch-manipulation cursor-pointer"
          >
            <Trash2 className="size-4" />
            <span>{deleteLabel}</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
