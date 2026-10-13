import { Eraser } from "lucide-react";
import type * as React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useMediaQuery } from "../hooks/use-media-query";

export interface ClearHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isClearing: boolean;
}

export function ClearHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
  isClearing,
}: ClearHistoryDialogProps) {
  const { t } = useTranslation("chat");
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const handleConfirmedClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onConfirm();
  };

  if (isDesktop) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Eraser className="text-muted-foreground" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t("clearHistory.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("clearHistory.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isClearing}
              className="cursor-pointer min-h-11 sm:min-h-9 touch-manipulation active:scale-97"
            >
              {t("clearHistory.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmedClear}
              disabled={isClearing}
              className="cursor-pointer min-h-11 sm:min-h-9 touch-manipulation active:scale-97"
            >
              {isClearing ? t("clearHistory.clearing") : t("clearHistory.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-4 pb-safe-lg max-h-[85vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-base font-semibold">
            {t("clearHistory.title")}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground">
            {t("clearHistory.description")}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="mt-4 flex flex-col gap-2 p-0">
          <Button
            variant="destructive"
            onClick={handleConfirmedClear}
            disabled={isClearing}
            className="h-11 min-h-11 w-full rounded-xl text-sm font-medium touch-manipulation active:scale-97 cursor-pointer"
          >
            {isClearing ? t("clearHistory.clearing") : t("clearHistory.confirm")}
          </Button>
          <DrawerClose
            render={
              <Button
                variant="outline"
                disabled={isClearing}
                className="h-11 min-h-11 w-full rounded-xl text-sm font-medium touch-manipulation active:scale-97 cursor-pointer"
              >
                {t("clearHistory.cancel")}
              </Button>
            }
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
