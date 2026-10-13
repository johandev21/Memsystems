import { FolderPlus, NotebookPen, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface MobileCreateDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNotebook?: () => void;
  onCreateFolder?: () => void;
}

export function MobileCreateDrawer({
  isOpen,
  onOpenChange,
  onCreateNotebook,
  onCreateFolder,
}: MobileCreateDrawerProps) {
  const { t } = useTranslation("notebooks");

  if (!onCreateNotebook && !onCreateFolder) return null;

  return (
    <>
      <button
        type="button"
        data-slot="mobile-create-fab"
        onClick={() => onOpenChange(true)}
        aria-label={t("library.create.aria")}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform duration-100 ease-out touch-manipulation cursor-pointer"
      >
        <Plus className="size-6 stroke-2" />
      </button>

      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="p-4 pb-safe-lg">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base font-semibold">
              {t("library.create.label")}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col gap-1 py-2">
            {onCreateNotebook && (
              <button
                type="button"
                data-slot="mobile-create-notebook"
                onClick={() => {
                  onOpenChange(false);
                  onCreateNotebook();
                }}
                className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none"
              >
                <NotebookPen className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">
                    {t("library.create.notebook")}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {t("library.create.notebookDescription")}
                  </span>
                </div>
              </button>
            )}

            {onCreateFolder && (
              <button
                type="button"
                data-slot="mobile-create-folder"
                onClick={() => {
                  onOpenChange(false);
                  onCreateFolder();
                }}
                className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none"
              >
                <FolderPlus className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">
                    {t("library.create.folder")}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {t("library.create.folderDescription")}
                  </span>
                </div>
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
