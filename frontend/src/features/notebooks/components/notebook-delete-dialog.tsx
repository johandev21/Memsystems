import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

export interface NotebookDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebookTitle: string | null | undefined;
  isDeleting: boolean;
  onDelete: () => void | Promise<void>;
}

export function NotebookDeleteDialog({
  open,
  onOpenChange,
  notebookTitle,
  isDeleting,
  onDelete,
}: NotebookDeleteDialogProps) {
  const { t } = useTranslation("notebooks");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("settings.delete")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("settings.deleteConfirm", {
              title: notebookTitle ?? t("settings.thisNotebook"),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t("settings.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={onDelete}>
            {isDeleting ? t("settings.deleting") : t("settings.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
