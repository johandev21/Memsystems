import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { notebookQueryOptions, updateNotebook } from "../api/notebooks";

export function EditableNotebookTitle({ id }: { id: string }) {
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
      toast.success("Notebook renamed");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to rename notebook");
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

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label="Edit notebook title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setTitle(currentTitle);
            setIsEditing(false);
          }
        }}
        className="text-sm font-semibold px-2 py-0.5 border border-foreground/30 bg-transparent text-foreground outline-none w-full max-w-[72vw] sm:w-60 sm:max-w-none rounded-xl focus:ring-1 focus:ring-ring"
        maxLength={200}
        disabled={mutation.isPending}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="text-sm font-semibold px-2 py-0.5 border border-transparent hover:border-foreground/20 cursor-text select-none text-foreground transition-colors duration-150 rounded-xl min-w-0 max-w-full truncate block text-left"
    >
      <span className="block truncate max-w-[55vw] sm:max-w-[60vw] lg:max-w-none">
        {currentTitle}
      </span>
    </button>
  );
}
