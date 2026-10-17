import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Download, Eraser, Pencil, Settings, SlidersHorizontal, Trash2 } from "lucide-react";
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
import {
  deleteNotebook,
  exportNotebook,
  notebookQueryOptions,
  updateNotebook,
} from "../../api/notebooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GROUNDING_MODES,
  resolveGroundingMode,
  type GroundingMode,
} from "../../model/grounding-mode";

export const EDIT_NOTEBOOK_EVENT = "edit-notebook";
export const CLEAR_NOTEBOOK_CHAT_EVENT = "clear-notebook-chat";

export interface NotebookSettingsDialogProps {
  notebookId: string;
}

export function NotebookSettingsDialog({ notebookId }: NotebookSettingsDialogProps) {
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
  const handleExport = async () => {
    setOpen(false);
    try {
      toast.loading(t("settings.exporting", "Exporting notebook…"), { id: `export-${notebookId}` });
      await exportNotebook(notebookId, notebook?.title);
      toast.success(t("settings.exportSuccess", "Notebook exported successfully"), {
        id: `export-${notebookId}`,
      });
    } catch {
      toast.error(t("settings.exportFailed", "Failed to export notebook"), {
        id: `export-${notebookId}`,
      });
    }
  };
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
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 cursor-pointer"
              aria-label={t("settings.ariaLabel")}
            />
          }
        >
          <Settings />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="text-sm font-semibold text-foreground">{t("settings.title")}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t("settings.description")}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
              <Pencil />
              <span>{t("settings.edit")}</span>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer whitespace-nowrap [&>svg:last-child]:ml-0">
                <SlidersHorizontal />
                <span>{t("groundingMode.label")}</span>
                <span className="ml-auto mr-1 text-xs text-muted-foreground font-normal capitalize">
                  {t(`groundingMode.${groundingMode}`)}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-72 p-1">
                <DropdownMenuRadioGroup
                  value={groundingMode}
                  onValueChange={(val) => handleGroundingModeChange(val as GroundingMode)}
                >
                  {GROUNDING_MODES.map((mode) => (
                    <DropdownMenuRadioItem
                      key={mode}
                      value={mode}
                      disabled={isSavingMode}
                      className="cursor-pointer items-start py-2 pr-8 [&_[data-slot=dropdown-menu-radio-item-indicator]]:top-2.5"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">
                          {t(`groundingMode.${mode}`)}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal leading-snug whitespace-normal">
                          {t(`groundingMode.descriptions.${mode}`)}
                        </span>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleClearChat} className="cursor-pointer">
              <Eraser />
              <span>{t("settings.clearChat")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
              <Download />
              <span>{t("settings.export", "Export notebook")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={handleOpenDelete}
              className="cursor-pointer"
            >
              <Trash2 />
              <span>{t("settings.delete")}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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
