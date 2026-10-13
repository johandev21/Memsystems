import { FilePlus, FolderPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface MobileSourceCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSource: () => void;
  onCreateFolder: () => void;
}

export function MobileSourceCreateDrawer({
  open,
  onOpenChange,
  onAddSource,
  onCreateFolder,
}: MobileSourceCreateDrawerProps) {
  const { t } = useTranslation(["sources", "tree"]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4 pb-safe-lg" showCloseButton={false}>
        <DrawerHeader className="sr-only">
          <DrawerTitle>
            {t("sources:mobile.newMenu", "New")}
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-1 py-1">
          <button
            type="button"
            data-slot="mobile-create-option-source"
            onClick={() => {
              onOpenChange(false);
              onAddSource();
            }}
            className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none [@media(hover:hover)]:hover:bg-muted"
          >
            <FilePlus className="size-5 shrink-0 text-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground">
                {t("sources:mobile.addSource", "Add source")}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {t("sources:addSourceDialog.description", "Search the web or bring in your own material.")}
              </span>
            </div>
          </button>

          <button
            type="button"
            data-slot="mobile-create-option-folder"
            onClick={() => {
              onOpenChange(false);
              onCreateFolder();
            }}
            className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none [@media(hover:hover)]:hover:bg-muted"
          >
            <FolderPlus className="size-5 shrink-0 text-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground">
                {t("tree:actions.newFolder", "New folder")}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {t("sources:mobile.newFolderDescription", "Organize sources into folders.")}
              </span>
            </div>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
