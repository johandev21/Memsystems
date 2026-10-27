import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

export interface TreeRowDragHandleProps {
  visible: boolean;
  disabled?: boolean;
  isDragging?: boolean;
  isCoarse: boolean;
  dragProps: Record<string, unknown>;
  onSelect: () => void;
  ariaLabel?: string;
  icon?: ReactNode;
}

export function TreeRowDragHandle({
  visible,
  disabled = false,
  isDragging = false,
  isCoarse,
  dragProps,
  onSelect,
  ariaLabel = "Drag handle",
  icon,
}: TreeRowDragHandleProps) {
  if (!visible) return null;
  const handlePointerDown = dragProps.onPointerDown as
    | ((event: React.PointerEvent) => void)
    | undefined;

  return (
    <button
      type="button"
      data-slot="tree-drag-handle"
      aria-label={ariaLabel}
      tabIndex={-1}
      disabled={disabled}
      className={cn(
        "shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none disabled:opacity-50",
        "hidden [@media(pointer:coarse)]:flex touch-manipulation select-none",
        isDragging && "opacity-50",
      )}
      {...dragProps}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (isCoarse) {
          (event.currentTarget.closest('[role="treeitem"]') as HTMLElement | null)?.focus();
          onSelect();
        }
        handlePointerDown?.(event);
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {icon ?? <GripVertical className="size-3.5" />}
    </button>
  );
}
