import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cancelSource, deleteSource, retrySource } from "../../api/sources";

export function useSourceMutations(notebookId: string) {
  const queryClient = useQueryClient();
  const [sourceToDelete, setSourceToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.success("Source removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retrySource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.info("Source processing restarted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      toast.info("Source processing cancelled");
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
