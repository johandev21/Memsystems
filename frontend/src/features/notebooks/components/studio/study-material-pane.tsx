import { lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MaterialViewerSkeleton } from "@/features/study-material-viewer/components/skeletons";
import type { StudyMaterialDTO, StudyMaterialKind } from "@/features/study-material-viewer/types";
import {
  studyMaterialQueryOptions,
  studyMaterialsQueryOptions,
} from "@/features/study-material-viewer/api";

// Lazy: the viewer graph (all material views + mind-map d3 + AI chat bridge)
// is only needed once an actual study material is displayed. Imported
// directly (not via the barrel) so the module stays out of statically-shared
// chunks.
const MaterialViewer = lazy(() =>
  import("@/features/study-material-viewer/components/MaterialViewer").then(
    (m) => ({ default: m.MaterialViewer }),
  ),
);

export function StudyMaterialPane({
  notebookId,
  materialId,
  initialMaterial,
  onClose,
  forceFullscreen,
  defaultFullscreen,
}: {
  notebookId: string;
  materialId: string;
  initialMaterial?: StudyMaterialDTO;
  onClose: () => void;
  forceFullscreen?: boolean;
  defaultFullscreen?: boolean;
}) {
  const queryClient = useQueryClient();
  const {
    data: material,
    isLoading,
    error,
  } = useQuery({
    ...studyMaterialQueryOptions(materialId),
    initialData: initialMaterial,
  });

  const cachedKind: StudyMaterialKind | null =
    initialMaterial?.kind ??
    queryClient
      .getQueryData<StudyMaterialDTO[]>(studyMaterialsQueryOptions(notebookId).queryKey)
      ?.find((item) => item.id === materialId)?.kind ??
    null;

  if (isLoading) {
    return <MaterialViewerSkeleton kind={cachedKind} />;
  }

  if (error || !material) {
    return <StudyMaterialError message={error?.message} onClose={onClose} />;
  }

  return (
    <Suspense fallback={<MaterialViewerSkeleton kind={material.kind} />}>
      <MaterialViewer
        material={material}
        onClose={onClose}
        forceFullscreen={forceFullscreen}
        defaultFullscreen={defaultFullscreen}
      />
    </Suspense>
  );
}

function StudyMaterialError({ message, onClose }: { message?: string; onClose: () => void }) {
  const { t } = useTranslation("notebooks");

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center gap-4">
      <p className="text-sm text-destructive">{message || t("viewer.loadFailed")}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-primary hover:underline cursor-pointer"
      >
        {t("viewer.goBack")}
      </button>
    </div>
  );
}
