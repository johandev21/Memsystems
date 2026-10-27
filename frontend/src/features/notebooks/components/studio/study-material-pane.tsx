import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  loadMaterialViewer,
  MaterialViewerSkeleton,
  useStudyMaterial,
  type StudyMaterialDTO,
} from "@/features/study-material-viewer";

const MaterialViewer = lazy(loadMaterialViewer);

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
  const { material, cachedKind, isLoading, error } = useStudyMaterial(
    notebookId,
    materialId,
    initialMaterial,
  );

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
