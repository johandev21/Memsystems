import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GatewayKeyPrompt, isConnectionUsable, useConnectionStatus } from "@/features/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModelPersistence } from "@/features/notebooks";
import { useGenerationStore } from "../hooks/use-generation-store";
import { KIND_LABELS, type StudyMaterialKind } from "@/features/study-material-viewer";
import type { RoadmapOptions, MindMapOptions, SlidesOptions } from "./forms/types";
import { BriefForm } from "./BriefForm";
import { cn } from "@/shared/utils/cn";

export interface GenerateBriefDialogProps {
  notebookId: string;
  kind: StudyMaterialKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (materialId: string) => void;
}

export function GenerateBriefDialog({
  notebookId,
  kind,
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
    slidesOptions,
  } = value;
  const { model: selectedModel } = useModelPersistence(notebookId);

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
        model: selectedModel,
        questionCount,
        difficulty,
        cardStyle,
        roadmapOptions,
        mindMapOptions,
        slidesOptions,
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
          (kind === "roadmap" || kind === "mind_map" || kind === "slides") && "sm:max-w-3xl",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-text-primary">
            Generate {label}
          </DialogTitle>
        </DialogHeader>
        {isConnectionUsable(connection) ? (
          <BriefForm
            notebookId={notebookId}
            kind={kind}
            value={value}
            onChange={updateBriefForm}
            onSubmit={handleSubmit}
            submitLabel="Generate"
            disabled={false}
          />
        ) : (
          <GatewayKeyPrompt description="An AI Gateway key is required to generate study materials." />
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
    questionCount?: number;
    difficulty?: "easy" | "medium" | "hard";
    cardStyle?: "qa" | "definition" | "cloze" | "mixed";
    roadmapOptions?: RoadmapOptions;
    mindMapOptions?: MindMapOptions;
    slidesOptions?: SlidesOptions;
  }>({
    brief: "",
    sourceIds: [],
    folderId: null,
    questionCount: 10,
    difficulty: "medium",
  });

  const updateBriefForm = (next: Partial<typeof value>) =>
    setValue((current) => ({ ...current, ...next }));
  const resetAfterSubmit = () =>
    setValue((current) => ({
      ...current,
      brief: "",
      roadmapOptions: undefined,
      mindMapOptions: undefined,
      slidesOptions: undefined,
    }));

  return { value, updateBriefForm, resetAfterSubmit };
}
