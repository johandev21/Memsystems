import { Folder, FolderInput } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SourceFolder } from "../../types/source-folder.types";

const TARGET_CLASS =
  "flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-foreground active:bg-muted active:scale-98 transition-transform touch-manipulation cursor-pointer [@media(hover:hover)]:hover:bg-muted";

export interface MobileMoveFolderPickerProps {
  folders: readonly SourceFolder[];
  canMoveToRoot: boolean;
  onSelect: (folderId: string | null) => void;
}

/** Folder destinations for the mobile "Move to folder" step (replaces drag-and-drop on touch). */
export function MobileMoveFolderPicker({
  folders,
  canMoveToRoot,
  onSelect,
}: MobileMoveFolderPickerProps) {
  const { t } = useTranslation("tree");

  return (
    <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto overscroll-contain py-1">
      {canMoveToRoot && (
        <button
          type="button"
          data-slot="mobile-move-target-root"
          onClick={() => onSelect(null)}
          className={TARGET_CLASS}
        >
          <FolderInput className="size-4.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{t("actions.moveToSourcesRoot", "Move to Sources root")}</span>
        </button>
      )}

      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          data-slot={`mobile-move-target-${folder.id}`}
          onClick={() => onSelect(folder.id)}
          className={TARGET_CLASS}
        >
          <Folder className="size-4.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{folder.name}</span>
        </button>
      ))}

      {!canMoveToRoot && folders.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {t("tree.emptyDescription", "No folders available")}
        </p>
      )}
    </div>
  );
}
