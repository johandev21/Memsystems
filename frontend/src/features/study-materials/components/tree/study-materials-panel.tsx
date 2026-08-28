import { StudyMaterialsTreeContainer } from "../study-materials-tree/ui/study-materials-tree-container";

export interface StudyMaterialsPanelProps {
  notebookId: string;
  onSelectMaterial: (materialId: string | null) => void;
}

export function StudyMaterialsPanel({ notebookId, onSelectMaterial }: StudyMaterialsPanelProps) {
  return (
    <StudyMaterialsTreeContainer
      notebookId={notebookId}
      onMaterialActivate={onSelectMaterial}
      variant="desktop"
    />
  );
}
