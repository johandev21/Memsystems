import {
  Brain,
  BookOpen,
  Briefcase,
  FileQuestion,
  Folder,
  FolderOpen,
  ListChecks,
  Map as MapIcon,
  Network,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { TreeNode } from "../../model/tree";
import { useTreeControllerContext } from "../controller";
import { studyMaterialsTreeVariants } from "./variants";

type DragPreviewProps = {
  node: TreeNode;
};

export function DragPreview({ node }: DragPreviewProps) {
  const controller = useTreeControllerContext();
  const Icon = getTreeIcon(node, true);
  return (
    <div
      data-slot="study-materials-tree-drag-preview"
      data-size={controller.size}
      className={cn(
        studyMaterialsTreeVariants({ size: controller.size }),
        "inline-flex w-fit max-w-[min(18rem,calc(100vw-2rem))] items-center gap-1.5 rounded-xl border border-transparent bg-popover/95 px-[var(--tree-drag-preview-px)] py-[var(--tree-drag-preview-py)] font-sans text-sm font-medium leading-none tracking-normal text-popover-foreground shadow-[0_8px_24px_oklch(0_0_0/0.14)] ring-1 ring-foreground/8 backdrop-blur-[6px] dark:shadow-[0_8px_24px_oklch(0_0_0/0.35)] dark:ring-white/10",
      )}
    >
      <Icon className="size-[var(--tree-icon-size)] shrink-0 opacity-80" strokeWidth={1.7} />
      <span className="truncate leading-none">{node.name}</span>
    </div>
  );
}

function getTreeIcon(node: TreeNode, isOpen: boolean): LucideIcon {
  if (node.type === "folder") return isOpen ? FolderOpen : Folder;

  switch (node.materialKind) {
    case "simple_flashcard":
      return Brain;
    case "roadmap":
      return MapIcon;
    case "study_guide":
      return BookOpen;
    case "practice_problems":
      return ListChecks;
    case "case_study":
      return Briefcase;
    case "slides":
      return Presentation;
    case "mind_map":
      return Network;
    case "quiz":
    default:
      return FileQuestion;
  }
}
