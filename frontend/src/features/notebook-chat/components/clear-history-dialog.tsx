import { Eraser } from "lucide-react";
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

interface ClearHistoryDialogProps {
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
  const handleConfirmedClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onConfirm();
  };

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
          <AlertDialogCancel disabled={isClearing} className="cursor-pointer">
            {t("clearHistory.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirmedClear}
            disabled={isClearing}
            className="cursor-pointer"
          >
            {isClearing ? t("clearHistory.clearing") : t("clearHistory.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
