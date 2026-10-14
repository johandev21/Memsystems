import { useCallback, useMemo, useState } from "react";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

export function useStudioDialogs() {
  const [generateKind, setGenerateKind] = useState<StudyMaterialKind | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudyMaterialId, setSelectedStudyMaterialId] = useState<string | null>(null);

  const handleGenerate = useCallback((kind: StudyMaterialKind) => {
    setGenerateKind(kind);
    setDialogOpen(true);
  }, []);

  const handleGenerateComplete = useCallback((materialId: string) => {
    setDialogOpen(false);
    setGenerateKind(null);
    setSelectedStudyMaterialId(materialId);
  }, []);

  return useMemo(
    () => ({
      generateKind,
      dialogOpen,
      selectedStudyMaterialId,
      handleGenerate,
      setDialogOpen,
      setSelectedStudyMaterialId,
      handleGenerateComplete,
    }),
    [
      generateKind,
      dialogOpen,
      selectedStudyMaterialId,
      handleGenerate,
      handleGenerateComplete,
    ],
  );
}

export type UseStudioDialogsReturn = ReturnType<typeof useStudioDialogs>;
