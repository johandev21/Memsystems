import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { LibraryItem } from "../model/library-sort";

export interface MobileRenameDrawerProps {
  item: LibraryItem | null;
  isOpen: boolean;
  value: string;
  onOpenChange: (open: boolean) => void;
  onChangeValue: (value: string) => void;
  onConfirm: () => void;
}

export function MobileRenameDrawer({
  item,
  isOpen,
  value,
  onOpenChange,
  onChangeValue,
  onConfirm,
}: MobileRenameDrawerProps) {
  const { t } = useTranslation("notebooks");

  const placeholder =
    item?.kind === "folder"
      ? t("folders.newFolderPlaceholder", "New folder name...")
      : t("banner.titlePlaceholder", "Notebook Title");

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4 pb-safe-lg">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base font-semibold">{t("library.rename")}</DrawerTitle>
          <DrawerDescription className="text-xs">{placeholder}</DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
          className="flex flex-col gap-4 py-2"
        >
          <Input
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            autoFocus
            className="h-11 text-base rounded-xl"
            placeholder={placeholder}
          />

          <DrawerFooter className="flex-row gap-2 p-0">
            <DrawerClose
              render={
                <Button variant="outline" className="flex-1 rounded-xl h-10 text-sm">
                  {t("banner.cancelEdits", "Cancel")}
                </Button>
              }
            />
            <Button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 rounded-xl h-10 text-sm"
            >
              {t("banner.save", "Save")}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
