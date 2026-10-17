import { FolderInput, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";

export interface TreeFloatingActionDockProps {
  selectedCount: number;
  itemTypeLabel?: string; // e.g. "source" or "material"
  onMove: () => void;
  onDelete: () => void;
  onDismiss: () => void;
  isMoving?: boolean;
  isDeleting?: boolean;
  className?: string;
}

export function TreeFloatingActionDock({
  selectedCount,
  itemTypeLabel = "item",
  onMove,
  onDelete,
  onDismiss,
  isMoving = false,
  isDeleting = false,
  className,
}: TreeFloatingActionDockProps) {
  if (selectedCount === 0) return null;

  const label = `${selectedCount} ${itemTypeLabel}${selectedCount === 1 ? "" : "s"}`;

  return (
    <div
      data-slot="tree-floating-action-dock"
      className={cn(
        "pointer-events-auto absolute bottom-2 left-2 right-2 z-30 flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/95 p-1.5 shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 pl-1.5">
        <span className="flex h-5 items-center rounded-md bg-primary/10 px-1.5 text-xs font-semibold text-primary tabular-nums">
          {selectedCount}
        </span>
        <span className="text-xs font-medium text-foreground">
          {label} selected
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={onMove}
                disabled={isMoving || isDeleting}
                className="h-7 cursor-pointer gap-1 px-2 text-xs font-medium active:scale-97 transition-transform touch-manipulation"
              >
                <FolderInput className="size-3.5" />
                <span>Move</span>
              </Button>
            }
          />
          <TooltipContent>Move selected {itemTypeLabel}s</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={isMoving || isDeleting}
                className="h-7 cursor-pointer gap-1 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-97 transition-transform touch-manipulation"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            }
          />
          <TooltipContent>Delete selected {itemTypeLabel}s</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border/60 mx-0.5" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                onClick={onDismiss}
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground active:scale-97 transition-transform touch-manipulation"
                aria-label="Dismiss selection"
              >
                <X className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Clear selection</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
