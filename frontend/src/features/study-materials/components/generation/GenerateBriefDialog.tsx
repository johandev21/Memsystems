import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OpenAIKeyPrompt, useConnectionStatus } from "@/features/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { useModelPersistence } from "@/features/notebooks";
import {
  useGenerationStore,
  KIND_LABELS,
  type StudyMaterialKind,
} from "@/features/study-materials";
import type { ModelOption } from "@/shared/api/models";
import type { RoadmapOptions, MindMapOptions } from "./forms/types";
import { BriefForm } from "./BriefForm";
import { cn } from "@/shared/lib/utils";

export interface GenerateBriefDialogProps {
  notebookId: string;
  kind: StudyMaterialKind | null;
  models: ModelOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (materialId: string) => void;
}

export function GenerateBriefDialog({
  notebookId,
  kind,
  models,
  open,
  onOpenChange,
  onComplete,
}: GenerateBriefDialogProps) {
  const queryClient = useQueryClient();
  const startBackgroundGeneration = useGenerationStore((s) => s.startBackgroundGeneration);
  const setCollapsed = useGenerationStore((s) => s.setCollapsed);
  const { data: connection } = useConnectionStatus();

  const { value, updateBriefForm, resetAfterSubmit } = useGenerationBriefState();
  const {
    brief,
    sourceIds,
    folderId,
    questionCount,
    difficulty,
    cardStyle,
    roadmapOptions,
    mindMapOptions,
  } = value;
  const { model: persistedModel, setModel: setPersistedModel } = useModelPersistence(notebookId);
  const model = persistedModel ?? "";

  const handleFormChange = (next: typeof value) => {
    updateBriefForm(next);
    if (next.model !== model) setPersistedModel(next.model);
  };

  const [prevModels, setPrevModels] = useState<ModelOption[] | null>(null);
  if (models !== prevModels) {
    setPrevModels(models);
    if (models && models.length > 0) {
      const exists = models.some((m) => m.id === model);
      if (!exists) {
        setPersistedModel(models[0].id);
      }
    }
  }

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!kind) return;

    startBackgroundGeneration(
      notebookId,
      {
        kind,
        brief,
        sourceIds,
        folderId,
        model,
        questionCount,
        difficulty,
        cardStyle,
        roadmapOptions,
        mindMapOptions,
      },
      queryClient,
      onComplete,
    );

    setCollapsed(false);
    onOpenChange(false);
    resetAfterSubmit();
  };

  if (kind === null) return null;

  const label = KIND_LABELS[kind] || kind;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "bg-surface-1 border border-surface-border generate-material-dialog",
          "sm:max-w-md",
          (kind === "quiz" || kind === "simple_flashcard") && "sm:max-w-2xl",
          (kind === "roadmap" || kind === "mind_map") && "sm:max-w-3xl",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-text-primary">
            Generate {label}
          </DialogTitle>
        </DialogHeader>
        {connection?.ok !== false ? (
          <BriefForm
            notebookId={notebookId}
            kind={kind}
            models={models}
            defaultModel={models[0]?.id}
            value={{ ...value, model }}
            onChange={handleFormChange}
            onSubmit={handleSubmit}
            submitLabel="Generate"
            disabled={false}
          />
        ) : (
          <OpenAIKeyPrompt description="An API key is required to generate study materials." />
        )}
      </DialogContent>
    </Dialog>
  );
}

function useGenerationBriefState() {
  const [value, setValue] = useState<{
    brief: string;
    sourceIds: string[];
    folderId: string | null;
    model: string;
    questionCount?: number;
    difficulty?: "easy" | "medium" | "hard";
    cardStyle?: "qa" | "definition" | "cloze" | "mixed";
    roadmapOptions?: RoadmapOptions;
    mindMapOptions?: MindMapOptions;
  }>({
    brief: "",
    sourceIds: [],
    folderId: null,
    model: "",
    questionCount: 10,
    difficulty: "medium",
  });

  const updateBriefForm = (next: typeof value) => setValue((current) => ({ ...current, ...next }));
  const resetAfterSubmit = () =>
    setValue((current) => ({
      ...current,
      brief: "",
      roadmapOptions: undefined,
      mindMapOptions: undefined,
    }));

  return { value, updateBriefForm, resetAfterSubmit };
}
