import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { StudyMaterialKind } from "@/features/study-materials";
import { modelsQueryOptions } from "@/shared/api";

export function useStudioDialogs() {
  const [generateKind, setGenerateKind] = useState<StudyMaterialKind | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudyMaterialId, setSelectedStudyMaterialId] = useState<string | null>(null);

  const models = useQuery(modelsQueryOptions);

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
    models: models.data ?? [],
    handleGenerate,
    setDialogOpen,
    setSelectedStudyMaterialId,
    handleGenerateComplete,
  };
}

export type UseStudioDialogsReturn = ReturnType<typeof useStudioDialogs>;
