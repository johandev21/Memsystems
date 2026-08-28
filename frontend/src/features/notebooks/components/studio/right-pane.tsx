import { useQuery } from "@tanstack/react-query";
import { MaterialViewer } from "@/features/study-material-viewer";
import { type StudyMaterialDTO, studyMaterialQueryOptions } from "@/features/study-material-viewer";

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
  notebookId: _notebookId,
  mode,
  onModeChange,
  forceFullscreen,
  defaultFullscreen,
}: RightPaneProps) {
  switch (mode.kind) {
    case "select":
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Select a study material to view its contents
          </p>
        </div>
      );
    case "viewer":
      return (
        <StudyMaterialPane
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
  materialId,
  initialMaterial,
  onClose,
  forceFullscreen,
  defaultFullscreen,
}: {
  materialId: string;
  initialMaterial?: StudyMaterialDTO;
  onClose: () => void;
  forceFullscreen?: boolean;
  defaultFullscreen?: boolean;
}) {
  const {
    data: material,
    isLoading,
    error,
  } = useQuery({
    ...studyMaterialQueryOptions(materialId),
    initialData: initialMaterial,
  });

  if (isLoading) {
    return <StudyMaterialLoading />;
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

function StudyMaterialLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
    </div>
  );
}

function StudyMaterialError({ message, onClose }: { message?: string; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center gap-4">
      <p className="text-sm text-destructive">{message || "Failed to load study material"}</p>
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-primary hover:underline cursor-pointer"
      >
        Go back
      </button>
    </div>
  );
}
