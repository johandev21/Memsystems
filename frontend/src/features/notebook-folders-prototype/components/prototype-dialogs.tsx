import { Button } from "@/components/ui/button";
import { InlineEditableText } from "./inline-editable-text";
import { MAX_TITLE_LENGTH } from "../model/title";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function NotebookDialog({
  notebook,
  onClose,
  onUpdate,
}: {
  notebook: {
    id: string;
    title: string;
    description: string;
    coverUrl: string | null;
    coverVariants?: { w480: string; w960: string } | null;
    icon?: string;
  };
  onClose: () => void;
  onUpdate: (id: string, patch: { title?: string; description?: string }) => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <InlineEditableText value={notebook.title} onSave={(title) => onUpdate(notebook.id, { title })} ariaLabel="notebook title" maxLength={MAX_TITLE_LENGTH} />
          </DialogTitle>
          <DialogDescription>
            <InlineEditableText value={notebook.description} onSave={(description) => onUpdate(notebook.id, { description })} ariaLabel="notebook description" multiline />
          </DialogDescription>
        </DialogHeader>
        {notebook.coverUrl && (
          <img
            src={notebook.coverUrl}
            srcSet={
              notebook.coverVariants
                ? `${notebook.coverVariants.w480} 480w, ${notebook.coverVariants.w960} 960w`
                : undefined
            }
            sizes="(min-width: 512px) 448px, calc(100vw - 2rem)"
            alt=""
            className="h-40 w-full rounded-xl object-cover"
            decoding="async"
          />
        )}
        <p className="text-sm text-muted-foreground">
          Seeded locally from the philosophy notebook collection.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Back to library</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
