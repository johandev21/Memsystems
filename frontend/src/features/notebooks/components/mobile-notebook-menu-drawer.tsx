import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Eraser,
  MoreVertical,
  Pencil,
  Settings,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
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
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/shared/utils/cn";
import { deleteNotebook, notebookQueryOptions, updateNotebook } from "../api/notebooks";
import {
  CLEAR_NOTEBOOK_CHAT_EVENT,
  EDIT_NOTEBOOK_EVENT,
} from "./dialogs/notebook-settings-dialog";
import {
  GROUNDING_MODES,
  resolveGroundingMode,
  type GroundingMode,
} from "../model/grounding-mode";

export interface MobileNotebookMenuDrawerProps {
  notebookId: string;
}

export function MobileNotebookMenuDrawer({ notebookId }: MobileNotebookMenuDrawerProps) {
  const { t } = useTranslation("notebooks");
  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  const [open, setOpen] = useState(false);
  const [groundingDrawerOpen, setGroundingDrawerOpen] = useState(false);
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

  const handleSelectGroundingMode = async (mode: GroundingMode) => {
    setGroundingDrawerOpen(false);
    if (mode !== groundingMode) {
      await handleGroundingModeChange(mode);
    }
  };

  const handleOpenGroundingDrawer = () => {
    setOpen(false);
    setGroundingDrawerOpen(true);
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

          <div className="flex flex-col gap-1 py-2">
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
              onClick={handleOpenGroundingDrawer}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted active:scale-97 transition-transform transition-colors touch-manipulation cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="size-4 text-muted-foreground shrink-0" />
                <span>{t("groundingMode.label")}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                <span className="capitalize">{t(`groundingMode.${groundingMode}`)}</span>
                <ChevronRight className="size-3.5 text-muted-foreground/60 shrink-0" />
              </div>
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
        </DrawerContent>
      </Drawer>

      <Drawer open={groundingDrawerOpen} onOpenChange={setGroundingDrawerOpen}>
        <DrawerContent className="p-4 pb-safe-lg max-h-[85vh]">
          <DrawerHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <SlidersHorizontal className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-1">
                <DrawerTitle className="text-base font-semibold">
                  {t("groundingMode.label")}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground">
                  {t("groundingMode.drawerDescription")}
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div
            className="flex flex-col gap-2 py-3"
            role="radiogroup"
            aria-label={t("groundingMode.label")}
          >
            {GROUNDING_MODES.map((mode) => {
              const isSelected = mode === groundingMode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isSavingMode}
                  onClick={() => handleSelectGroundingMode(mode)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98] touch-manipulation",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border/60 bg-muted/20 hover:bg-muted/40",
                  )}
                >
                  <div className="flex flex-col gap-0.5 pr-3">
                    <span className="text-sm font-semibold text-foreground">
                      {t(`groundingMode.${mode}`)}
                    </span>
                    <span className="text-xs text-muted-foreground leading-normal">
                      {t(`groundingMode.descriptions.${mode}`)}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <DrawerFooter className="mt-2 flex flex-col gap-2 p-0">
            <DrawerClose
              render={
                <Button
                  variant="outline"
                  className="h-11 min-h-11 w-full rounded-xl text-sm font-medium touch-manipulation active:scale-97 cursor-pointer"
                >
                  {t("settings.cancel")}
                </Button>
              }
            />
          </DrawerFooter>
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
