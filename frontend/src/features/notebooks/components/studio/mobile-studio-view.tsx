import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useGenerationStore } from "@/features/study-material-generation/hooks/use-generation-store";
import { sourcesQueryOptions } from "@/features/sources/api/sources";
import { ActiveGenerationList } from "../shared/studio-resources";
import { MobileStudyMaterialCreateDrawer } from "./mobile-study-material-create-drawer";
import { MobileStudyMaterialsPanel } from "@/features/study-material-tree";
import type { StudyMaterialKind } from "@/features/study-material-viewer";

export interface MobileStudioViewProps {
  notebookId: string;
  onGenerate: (kind: StudyMaterialKind) => void;
  onSelectMaterial: (materialId: string | null) => void;
}

export function MobileStudioView({
  notebookId,
  onGenerate,
  onSelectMaterial,
}: MobileStudioViewProps) {
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const storeGenerations = useGenerationStore((s) => s.generations);
  const cancelBackgroundGeneration = useGenerationStore((s) => s.cancelBackgroundGeneration);
  const sourcesQuery = useQuery(sourcesQueryOptions(notebookId));
  const totalSourceCount = sourcesQuery.data?.length ?? 0;

  const activeGenerations = Object.values(storeGenerations).filter(
    (g) => g.notebookId === notebookId,
  );

  return (
    <div className="relative flex h-full min-w-0 flex-col bg-background">
      <div
        data-slot="studio-panel-content"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {activeGenerations.length > 0 && (
          <div className="px-2 pt-2 pb-1">
            <ActiveGenerationList
              generations={activeGenerations}
              totalSourceCount={totalSourceCount}
              onCancel={(generationId) => cancelBackgroundGeneration(notebookId, generationId)}
            />
          </div>
        )}

        <MobileStudyMaterialsPanel
          notebookId={notebookId}
          onSelectMaterial={onSelectMaterial}
        />
      </div>

      <CreateMaterialFab onOpen={() => setCreateDrawerOpen(true)} />

      <MobileStudyMaterialCreateDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        onGenerate={onGenerate}
        onCreateFolder={() => {
          // Trigger folder creation in active folder or root
          window.dispatchEvent(new CustomEvent("create-study-material-folder"));
        }}
      />
    </div>
  );
}

function CreateMaterialFab({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation("notebooks");

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end px-4 pb-safe-lg">
      <button
        type="button"
        data-slot="mobile-create-material-fab"
        onClick={onOpen}
        aria-label={t("studio.newMaterial", "New study material")}
        className="pointer-events-auto flex size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 touch-manipulation"
      >
        <Plus className="size-6" />
      </button>
    </div>
  );
}
