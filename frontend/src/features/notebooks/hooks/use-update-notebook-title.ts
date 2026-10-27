import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { notebookQueryOptions, updateNotebook } from "../api/notebooks";

export function useUpdateNotebookTitle(id: string) {
  const { t } = useTranslation("notebooks");
  const queryClient = useQueryClient();
  const { data: notebook } = useQuery(notebookQueryOptions(id));
  const [isEditing, setIsEditing] = useState(false);
  const currentTitle = notebook?.title ?? "Untitled";
  const [prevDbTitle, setPrevDbTitle] = useState(currentTitle);
  const [title, setTitle] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  if (currentTitle !== prevDbTitle) {
    setPrevDbTitle(currentTitle);
    setTitle(currentTitle);
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const mutation = useMutation({
    mutationFn: (newTitle: string) => updateNotebook(id, { title: newTitle }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["notebooks", id], updated);
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success(t("notebook.renamed"));
      setIsEditing(false);
    },
    onError: () => {
      toast.error(t("notebook.renameFailed"));
      setTitle(currentTitle);
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(currentTitle);
      setIsEditing(false);
      return;
    }
    if (trimmed === currentTitle) {
      setIsEditing(false);
      return;
    }
    mutation.mutate(trimmed);
  };

  const handleCancel = () => {
    setTitle(currentTitle);
    setIsEditing(false);
  };

  return {
    title,
    setTitle,
    currentTitle,
    isEditing,
    setIsEditing,
    isPending: mutation.isPending,
    inputRef,
    handleSave,
    handleCancel,
  };
}

export const useNotebookTitleEditor = useUpdateNotebookTitle;
