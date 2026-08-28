import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eraser, Pencil, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { deleteNotebook, notebookQueryOptions } from "../../api/notebooks";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export const EDIT_NOTEBOOK_EVENT = "edit-notebook";
export const CLEAR_NOTEBOOK_CHAT_EVENT = "clear-notebook-chat";

export interface NotebookSettingsDialogProps {
  notebookId: string;
}

export function NotebookSettingsDialog({ notebookId }: NotebookSettingsDialogProps) {
  const { data: notebook } = useQuery(notebookQueryOptions(notebookId));
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
    try {
      await deleteNotebook(notebookId);
      await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      toast.success("Notebook deleted");
      navigate({ to: "/home" });
    } catch {
      toast.error("Failed to delete notebook");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 cursor-pointer"
              aria-label="Notebook settings"
            />
          }
        >
          <Settings />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-64 gap-2 rounded-2xl p-2">
          <PopoverHeader className="px-2 py-1.5">
            <PopoverTitle className="text-sm">Notebook</PopoverTitle>
            <PopoverDescription className="text-xs">
              Edit or manage this notebook.
            </PopoverDescription>
          </PopoverHeader>
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              className="justify-start hover:!bg-popover-hover focus-visible:!bg-popover-hover"
              onClick={handleEdit}
            >
              <Pencil data-icon="inline-start" />
              Edit notebook
            </Button>
            <Button
              variant="ghost"
              className="justify-start hover:!bg-popover-hover focus-visible:!bg-popover-hover"
              onClick={handleClearChat}
            >
              <Eraser data-icon="inline-start" />
              Clear chat
            </Button>
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:!bg-popover-hover hover:!text-destructive focus-visible:!bg-popover-hover"
              onClick={handleOpenDelete}
            >
              <Trash2 data-icon="inline-start" />
              Delete notebook
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete notebook</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete “{notebook?.title ?? "this notebook"}” and all associated sources
              and notes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? "Deleting…" : "Delete notebook"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
