import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MaterialViewer, MaterialViewerSkeleton } from "@/features/study-material-viewer";
import {
  type StudyMaterialDTO,
  type StudyMaterialKind,
  studyMaterialQueryOptions,
  studyMaterialsQueryOptions,
} from "@/features/study-material-viewer";

export type RightPaneMode =
  | { kind: "select" }
  | { kind: "viewer"; materialId: string; initialMaterial?: StudyMaterialDTO };

export interface RightPaneProps {
  notebookId: string;
  mode: RightPaneMode;
  onModeChange: (mode: RightPaneMode) => void;
  forceFullscreen?: boolean;
  defaultFullscreen?: boolean;
}

export function RightPane({
  notebookId,
  mode,
  onModeChange,
  forceFullscreen,
  defaultFullscreen,
}: RightPaneProps) {
  const { t } = useTranslation("notebooks");

  switch (mode.kind) {
    case "select":
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t("viewer.select")}
          </p>
        </div>
      );
    case "viewer":
      return (
        <StudyMaterialPane
          notebookId={notebookId}
          materialId={mode.materialId}
          initialMaterial={mode.initialMaterial}
          onClose={() => onModeChange({ kind: "select" })}
          forceFullscreen={forceFullscreen}
          defaultFullscreen={defaultFullscreen}
        />
      );
  }
}

function StudyMaterialPane({
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
    <MaterialViewer
      material={material}
      onClose={onClose}
      forceFullscreen={forceFullscreen}
      defaultFullscreen={defaultFullscreen}
    />
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
