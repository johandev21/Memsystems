import { cva } from "class-variance-authority";
import type { CSSProperties } from "react";
import { cn } from "@/shared/utils/cn";

export const treeVariants = cva("group/tree", {
  variants: {
    size: {
      sm: [
        "data-[size=sm]:[--tree-row-height:calc(var(--spacing)*6)]",
        "data-[size=sm]:[--tree-header-min-height:calc(var(--spacing)*8)]",
        "data-[size=sm]:[--tree-font-size:0.75rem]",
        "data-[size=sm]:[--tree-icon-size:calc(var(--spacing)*3.5)]",
        "data-[size=sm]:[--tree-indent-step:calc(var(--spacing)*3)]",
        "data-[size=sm]:[--tree-root-inset:calc(var(--spacing)*2)]",
        "data-[size=sm]:[--tree-rename-height:calc(var(--spacing)*5)]",
        "data-[size=sm]:[--tree-header-control-size:calc(var(--spacing)*6)]",
        "data-[size=sm]:[--tree-drag-preview-px:calc(var(--spacing)*2.5)]",
        "data-[size=sm]:[--tree-drag-preview-py:calc(var(--spacing)*1.5)]",
      ].join(" "),
      default: [
        "data-[size=default]:[--tree-row-height:calc(var(--spacing)*7)]",
        "data-[size=default]:[--tree-header-min-height:calc(var(--spacing)*9)]",
        "data-[size=default]:[--tree-font-size:0.8125rem]",
        "data-[size=default]:[--tree-icon-size:calc(var(--spacing)*4)]",
        "data-[size=default]:[--tree-indent-step:calc(var(--spacing)*4)]",
        "data-[size=default]:[--tree-root-inset:calc(var(--spacing)*3)]",
        "data-[size=default]:[--tree-rename-height:calc(var(--spacing)*6)]",
        "data-[size=default]:[--tree-header-control-size:calc(var(--spacing)*7)]",
        "data-[size=default]:[--tree-drag-preview-px:calc(var(--spacing)*3)]",
        "data-[size=default]:[--tree-drag-preview-py:calc(var(--spacing)*2)]",
      ].join(" "),
      lg: [
        "data-[size=lg]:[--tree-row-height:calc(var(--spacing)*8)]",
        "data-[size=lg]:[--tree-header-min-height:calc(var(--spacing)*10)]",
        "data-[size=lg]:[--tree-font-size:0.875rem]",
        "data-[size=lg]:[--tree-icon-size:calc(var(--spacing)*4.5)]",
        "data-[size=lg]:[--tree-indent-step:calc(var(--spacing)*5)]",
        "data-[size=lg]:[--tree-root-inset:calc(var(--spacing)*4)]",
        "data-[size=lg]:[--tree-rename-height:calc(var(--spacing)*7)]",
        "data-[size=lg]:[--tree-header-control-size:calc(var(--spacing)*8)]",
        "data-[size=lg]:[--tree-drag-preview-px:calc(var(--spacing)*3.5)]",
        "data-[size=lg]:[--tree-drag-preview-py:calc(var(--spacing)*2.5)]",
      ].join(" "),
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export function getTreeRowPadStyle(depth: number): CSSProperties {
  return {
    "--tree-row-pad": `calc(var(--tree-root-inset) + ${depth} * var(--tree-indent-step))`,
  } as CSSProperties;
}

export interface TreeRowClassNameOptions {
  isSelected?: boolean;
  treeHasFocus?: boolean;
  isOver?: boolean;
  canAcceptDrop?: boolean;
  isDragging?: boolean;
  isActiveItem?: boolean;
  isRenaming?: boolean;
  isCoarse?: boolean;
  className?: string;
}

export function getTreeRowClassName({
  isSelected = false,
  treeHasFocus = false,
  isOver = false,
  canAcceptDrop = false,
  isDragging = false,
  isActiveItem = false,
  isRenaming = false,
  isCoarse = false,
  className,
}: TreeRowClassNameOptions): string {
  const isDragActive = isDragging || isActiveItem;
  return cn(
    "group/tree-row relative flex h-(--tree-row-height) w-full min-w-0 items-center gap-1.5 rounded-xl pr-1 pl-(--tree-row-pad) text-left font-sans text-sm outline-none select-none",
    "text-muted-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring",
    "hover:bg-muted/70 hover:text-foreground",
    isSelected && treeHasFocus && "bg-accent/35 text-foreground ring-1 ring-inset ring-ring",
    isOver && canAcceptDrop && "bg-accent/60 text-accent-foreground",
    isDragActive && "opacity-35 cursor-grabbing",
    isRenaming && "cursor-text",
    !isRenaming && !isDragActive && (isCoarse ? "cursor-default" : "cursor-pointer"),
    className,
  );
}
