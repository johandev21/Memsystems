import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { RightPane, type RightPaneMode } from "@/features/notebooks";
import { studyMaterialsQueryOptions } from "@/shared/api/study-materials";
import { StudyMaterialsEmptyState } from "./study-materials-empty-state";

export interface MobileExpandedStudyMaterialsProps {
  notebookId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialMaterialId?: string | null;
}

export function MobileExpandedStudyMaterials({
  notebookId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialMaterialId,
}: MobileExpandedStudyMaterialsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen;

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialMaterialId, setPrevInitialMaterialId] = useState(initialMaterialId);
  const [mode, setMode] = useState<RightPaneMode>({ kind: "select" });

  if (isOpen !== prevIsOpen || initialMaterialId !== prevInitialMaterialId) {
    setPrevIsOpen(isOpen);
    setPrevInitialMaterialId(initialMaterialId);
    if (isOpen) {
      setMode(
        initialMaterialId ? { kind: "viewer", materialId: initialMaterialId } : { kind: "select" },
      );
    }
  }

  const materialsQuery = useQuery(studyMaterialsQueryOptions(notebookId));
  const hasMaterials = (materialsQuery.data?.length ?? 0) > 0 || !!initialMaterialId;
  const activeMaterial = materialsQuery.data?.find(
    (m) => m.id === (mode.kind === "viewer" ? mode.materialId : null),
  );
  const title = activeMaterial?.title ?? "Study Materials";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[92vw] sm:max-w-[80vw] h-[85vh] max-h-[85vh] p-0 gap-0 flex flex-col rounded-3xl overflow-hidden bg-surface-1 border border-surface-border"
      >
        <DialogHeader className="px-4 py-1.5 bg-surface-1 min-h-[44px] flex flex-col justify-center border-b border-surface-border-subtle shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-text-primary truncate max-w-[80%]">
              {title}
            </DialogTitle>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 text-text-faint hover:text-text-secondary cursor-pointer"
                />
              }
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>
        {materialsQuery.isPending && !hasMaterials ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-text-faint" />
          </div>
        ) : !hasMaterials ? (
          <div className="flex-1 flex items-center justify-center">
            <StudyMaterialsEmptyState />
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-surface-1">
            <RightPane notebookId={notebookId} mode={mode} onModeChange={setMode} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
