import { BookOpen, FileText, Folder, Sparkles } from "lucide-react";
import type { TrashKind } from "../api/trash";

export function TrashItemIcon({ kind }: { kind: TrashKind }) {
  switch (kind) {
    case "notebook_folder":
    case "source_folder":
    case "study_material_folder":
      return <Folder className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />;
    case "notebook":
      return <BookOpen className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />;
    case "source":
      return <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />;
    case "study_material":
      return <Sparkles className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />;
  }
}
