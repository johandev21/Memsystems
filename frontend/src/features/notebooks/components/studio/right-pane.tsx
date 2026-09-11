import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { StudyMaterialDTO } from "@/features/study-material-viewer/types";

// Lazy: everything the material view needs (queries, skeletons, the viewer
// graph itself) lives behind this boundary so the notebook route never loads
// it until a study material is actually opened.
const StudyMaterialPane = lazy(() =>
  import("./study-material-pane").then((m) => ({ default: m.StudyMaterialPane })),
);

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
        <Suspense
          fallback={
            <div className="flex h-full flex-col items-center justify-center p-8 text-center gap-2">
              <p className="text-sm text-muted-foreground">{t("viewer.select")}</p>
            </div>
          }
        >
          <StudyMaterialPane
            notebookId={notebookId}
            materialId={mode.materialId}
            initialMaterial={mode.initialMaterial}
            onClose={() => onModeChange({ kind: "select" })}
            forceFullscreen={forceFullscreen}
            defaultFullscreen={defaultFullscreen}
          />
        </Suspense>
      );
  }
}
