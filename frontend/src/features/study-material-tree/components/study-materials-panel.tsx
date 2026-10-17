import { memo } from "react";
import { StudyMaterialsTreeContainer } from "./ui/study-materials-tree-container";

export interface StudyMaterialsPanelProps {
  notebookId: string;
  onSelectMaterial: (materialId: string | null) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
}

export const StudyMaterialsPanel = memo(function StudyMaterialsPanel({
  notebookId,
  onSelectMaterial,
  isExpanded,
  onToggleExpand,
  isSearchOpen,
  onToggleSearch,
}: StudyMaterialsPanelProps) {
  return (
    <StudyMaterialsTreeContainer
      notebookId={notebookId}
      onMaterialActivate={onSelectMaterial}
      variant="desktop"
      isPanelExpanded={isExpanded}
      onPanelToggle={onToggleExpand}
      isSearchOpen={isSearchOpen}
      onToggleSearch={onToggleSearch}
    />
  );
});
