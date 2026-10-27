import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  deleteNotebook,
  exportNotebook,
  notebookQueryOptions,
  updateNotebook,
} from "../api/notebooks";
import { resolveGroundingMode, type GroundingMode } from "../model/grounding-mode";
import type { Notebook } from "../types/notebook.types";

export const EDIT_NOTEBOOK_EVENT = "edit-notebook";
export const CLEAR_NOTEBOOK_CHAT_EVENT = "clear-notebook-chat";

export interface UseNotebookSettingsActionsOptions {
  onAction?: () => void;
}

export function useNotebookSettingsActions(
  notebookId: string,
  options?: UseNotebookSettingsActionsOptions,
) {
  const { t } = useTranslation("notebooks");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const groundingMode = resolveGroundingMode(undefined, notebook?.groundingMode);

  const updateNotebookMutation = useMutation({
    mutationFn: (
      updates: Partial<
        Pick<
          Notebook,
          "title" | "description" | "icon" | "folderId" | "bannerFocalPoint" | "groundingMode"
        >
      >,
    ) => updateNotebook(notebookId, updates),
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] }),
        queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
      ]);
    },
  });

  const deleteNotebookMutation = useMutation({
    mutationFn: () => deleteNotebook(notebookId),
    onSuccess: async () => {
      const returnFolderId = notebook?.folderId;
      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success(t("settings.deleted"));
      navigate({
        to: "/",
        search: returnFolderId ? { folderId: returnFolderId } : undefined,
      });
    },
    onError: () => {
      toast.error(t("settings.deleteFailed"));
    },
  });

  const handleGroundingModeChange = async (mode: GroundingMode) => {
    if (mode === groundingMode || updateNotebookMutation.isPending) return;
    try {
      await updateNotebookMutation.mutateAsync({ groundingMode: mode });
      toast.success(t("settings.groundingModeUpdated"));
    } catch {
      toast.error(t("settings.groundingModeFailed"));
    }
  };

  const dispatchNotebookAction = (name: string) => {
    options?.onAction?.();
    window.dispatchEvent(new CustomEvent(name, { detail: { notebookId } }));
  };

  const handleEditNotebook = () => dispatchNotebookAction(EDIT_NOTEBOOK_EVENT);
  const handleClearHistory = () => dispatchNotebookAction(CLEAR_NOTEBOOK_CHAT_EVENT);

  const handleExportNotebook = async () => {
    options?.onAction?.();
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
    options?.onAction?.();
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    await deleteNotebookMutation.mutateAsync();
  };

  return {
    notebook,
    groundingMode,
    isSavingMode: updateNotebookMutation.isPending,
    isDeleting: deleteNotebookMutation.isPending,
    deleteDialogOpen,
    setDeleteDialogOpen,
    updateNotebookMutation,
    deleteNotebookMutation,
    handleGroundingModeChange,
    handleEditNotebook,
    handleClearHistory,
    handleExportNotebook,
    handleOpenDelete,
    handleConfirmDelete,
  };
}
