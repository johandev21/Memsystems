import { Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/shared/utils/cn";
import type { LibraryItem } from "../model/library-sort";
import type { LibraryFolder } from "../model/types";

export interface MobileMoveDrawerProps {
  item: LibraryItem | null;
  isOpen: boolean;
  folders: LibraryFolder[];
  onOpenChange: (open: boolean) => void;
  onSelectFolder: (targetFolderId: string | null) => void;
}

export function MobileMoveDrawer({
  item,
  isOpen,
  folders,
  onOpenChange,
  onSelectFolder,
}: MobileMoveDrawerProps) {
  const { t } = useTranslation("notebooks");
  const notebook = item?.kind === "notebook" ? item.notebook : null;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4 pb-safe-lg max-h-[70vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base font-semibold">
            {t("library.selectDestinationFolder", "Select destination folder")}
          </DrawerTitle>
          <DrawerDescription className="text-xs">{notebook?.title ?? ""}</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-1 overflow-y-auto py-2">
          <button
            type="button"
            onClick={() => onSelectFolder(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl p-3 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98] touch-manipulation cursor-pointer",
              notebook?.folderId === null ? "bg-muted text-foreground" : "text-foreground",
            )}
          >
            <span className="flex items-center gap-2.5">
              <Folder className="size-4 text-primary" />
              <span>{t("folders.notebookRoot", "Library Root")}</span>
            </span>
            {notebook?.folderId === null && (
              <span className="text-xs text-muted-foreground">Current</span>
            )}
          </button>

          {folders.map((folder) => {
            const isCurrent = notebook?.folderId === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => onSelectFolder(folder.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl p-3 text-sm font-medium transition-colors hover:bg-muted active:scale-[0.98] touch-manipulation cursor-pointer",
                  isCurrent ? "bg-muted text-foreground" : "text-foreground",
                )}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Folder className="size-4 text-primary shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </span>
                {isCurrent && <span className="text-xs text-muted-foreground">Current</span>}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
