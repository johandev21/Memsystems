import {
  Brain,
  FileQuestion,
  Folder,
  FolderOpen,
  Map as MapIcon,
  Network,
  Presentation,
  Headphones,
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
    case "slides":
      return Presentation;
    case "audio_overview":
      return Headphones;
    case "mind_map":
      return Network;
    case "quiz":
    default:
      return FileQuestion;
  }
}
