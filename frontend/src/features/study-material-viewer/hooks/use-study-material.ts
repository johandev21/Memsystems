import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { StudyMaterialDTO, StudyMaterialKind } from "../types/study-material.types";
import { studyMaterialQueryOptions, studyMaterialsQueryOptions } from "../api/study-materials";
import { useGenerationStore } from "@/features/study-material-generation";

export function useStudyMaterial(
  notebookId: string,
  materialId: string,
  initialData?: StudyMaterialDTO,
) {
  const queryClient = useQueryClient();
  const generations = useGenerationStore((s) => s.generations);
  const isGenerating = Object.values(generations).some(
    (g) => g.notebookId === notebookId && (g.status === "connecting" || g.status === "streaming"),
  );

  const query = useQuery({
    ...studyMaterialQueryOptions(materialId),
    initialData,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (isGenerating || (!data && !q.state.error)) {
        return 2000;
      }
      return false;
    },
  });

  const cachedKind: StudyMaterialKind | null =
    initialData?.kind ??
    queryClient
      .getQueryData<StudyMaterialDTO[]>(studyMaterialsQueryOptions(notebookId).queryKey)
      ?.find((item) => item.id === materialId)?.kind ??
    null;

  return {
    material: query.data,
    cachedKind,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    query,
  };
}
