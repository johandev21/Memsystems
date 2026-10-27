import { useTranslation } from "react-i18next";
import { MobileMoveFolderPickerView } from "@/shared/components/ui/mobile-folder-move-panel";
import type { SourceFolder } from "../../types/source-folder.types";

export interface MobileMoveFolderPickerProps {
  folders: readonly SourceFolder[];
  canMoveToRoot: boolean;
  onSelect: (folderId: string | null) => void;
}

export function MobileMoveFolderPicker({
  folders,
  canMoveToRoot,
  onSelect,
}: MobileMoveFolderPickerProps) {
  const { t } = useTranslation("tree");

  return (
    <MobileMoveFolderPickerView
      folders={folders}
      canMoveToRoot={canMoveToRoot}
      rootLabel={t("actions.moveToSourcesRoot", "Move to Sources root")}
      emptyLabel={t("tree.emptyDescription", "No folders available")}
      onSelect={onSelect}
    />
  );
}
