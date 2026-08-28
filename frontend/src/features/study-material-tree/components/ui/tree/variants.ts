import { cva } from "class-variance-authority";

export type StudyMaterialsTreeSize = "sm" | "default" | "lg";

export const studyMaterialsTreeVariants = cva("group/study-materials-tree", {
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
