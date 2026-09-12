import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cancelSource, deleteSource, retrySource } from "../../api/sources";

export function useSourceMutations(notebookId: string) {
  const { t } = useTranslation("sources");
  const queryClient = useQueryClient();
  const [sourceToDelete, setSourceToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.success(t("toasts.sourceRemoved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retrySource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.info(t("toasts.sourceProcessingRestarted"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.info(t("toasts.sourceProcessingCancelled"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    sourceToDelete,
    setSourceToDelete,
    deleteMutation,
    retryMutation,
    cancelMutation,
  };
}
