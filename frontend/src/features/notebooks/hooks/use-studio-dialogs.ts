import { useState } from "react";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

export function useStudioDialogs() {
  const [generateKind, setGenerateKind] = useState<StudyMaterialKind | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudyMaterialId, setSelectedStudyMaterialId] = useState<string | null>(null);

  const handleGenerate = (kind: StudyMaterialKind) => {
    setGenerateKind(kind);
    setDialogOpen(true);
  };

  const handleGenerateComplete = (materialId: string) => {
    setDialogOpen(false);
    setGenerateKind(null);
    setSelectedStudyMaterialId(materialId);
  };

  return {
    generateKind,
    dialogOpen,
    selectedStudyMaterialId,
    handleGenerate,
    setDialogOpen,
    setSelectedStudyMaterialId,
    handleGenerateComplete,
  };
}

export type UseStudioDialogsReturn = ReturnType<typeof useStudioDialogs>;

