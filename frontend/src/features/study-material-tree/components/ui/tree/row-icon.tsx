import {
  BookOpen,
  Brain,
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
import type { TreeNode } from "../../model/tree";

export function getTreeIcon(node: TreeNode, isOpen: boolean): LucideIcon {
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
