import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { retrySource } from "../api/sources";
import type { SourceWithContent } from "../types/source.types";

export function useRetrySource(source: Pick<SourceWithContent, "id" | "notebookId">) {
  const { t } = useTranslation("sources");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => retrySource(source.id),
    onSuccess: async () => {
      toast.info(t("toasts.sourceProcessingRestarted"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["source", source.id] }),
        queryClient.invalidateQueries({ queryKey: ["sources", source.notebookId] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
