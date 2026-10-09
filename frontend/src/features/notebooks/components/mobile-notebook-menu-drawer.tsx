import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eraser, MoreVertical, Pencil, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { deleteNotebook, notebookQueryOptions, updateNotebook } from "../api/notebooks";
import {
  CLEAR_NOTEBOOK_CHAT_EVENT,
  EDIT_NOTEBOOK_EVENT,
} from "./dialogs/notebook-settings-dialog";
import { GroundingModePicker } from "./shared/grounding-mode-picker";
import { resolveGroundingMode, type GroundingMode } from "../model/grounding-mode";

export interface MobileNotebookMenuDrawerProps {
  notebookId: string;
}

export function MobileNotebookMenuDrawer({ notebookId }: MobileNotebookMenuDrawerProps) {
  const { t } = useTranslation("notebooks");
  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMode, setIsSavingMode] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const groundingMode = resolveGroundingMode(undefined, notebook?.groundingMode);

  const handleGroundingModeChange = async (mode: GroundingMode) => {
    if (mode === groundingMode || isSavingMode) return;
    setIsSavingMode(true);
    try {
      await updateNotebook(notebookId, { groundingMode: mode });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] }),
        queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
      ]);
      toast.success(t("settings.groundingModeUpdated"));
    } catch {
      toast.error(t("settings.groundingModeFailed"));
    } finally {
      setIsSavingMode(false);
    }
  };

  const dispatchNotebookAction = (name: string) => {
    window.dispatchEvent(new CustomEvent(name, { detail: { notebookId } }));
    setOpen(false);
  };

  const handleEdit = () => dispatchNotebookAction(EDIT_NOTEBOOK_EVENT);
  const handleClearChat = () => dispatchNotebookAction(CLEAR_NOTEBOOK_CHAT_EVENT);

  const handleOpenDelete = () => {
    setOpen(false);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const returnFolderId = notebook?.folderId;
    try {
      await deleteNotebook(notebookId);
      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success(t("settings.deleted"));
      navigate({
        to: "/",
        search: returnFolderId ? { folderId: returnFolderId } : undefined,
      });
    } catch {
      toast.error(t("settings.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full cursor-pointer active:scale-97 transition-transform touch-manipulation"
              aria-label={t("settings.ariaLabel")}
            />
          }
        >
          <MoreVertical className="size-4.5" />
        </DrawerTrigger>
        <DrawerContent className="p-4 pb-safe-lg max-h-[85vh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base font-semibold truncate">
              {notebook?.title ?? t("settings.title")}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              {t("settings.description")}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-2 py-2">
            <div className="rounded-2xl border border-border/40 bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("groundingMode.label")}
              </p>
              <GroundingModePicker
                value={groundingMode}
                onChange={handleGroundingModeChange}
                disabled={isSavingMode}
              />
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={handleEdit}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
              >
                <Pencil className="size-4 text-muted-foreground shrink-0" />
                <span>{t("settings.edit")}</span>
              </button>

              <button
                type="button"
                onClick={handleClearChat}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
              >
                <Eraser className="size-4 text-muted-foreground shrink-0" />
                <span>{t("settings.clearChat")}</span>
              </button>

              <Link
                to="/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
              >
                <Settings className="size-4 text-muted-foreground shrink-0" />
                <span>{t("settings.appSettings", "App settings")}</span>
              </Link>

              <button
                type="button"
                onClick={handleOpenDelete}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
              >
                <Trash2 className="size-4 shrink-0" />
                <span>{t("settings.delete")}</span>
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.deleteConfirm", {
                title: notebook?.title ?? t("settings.thisNotebook"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("settings.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? t("settings.deleting") : t("settings.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
