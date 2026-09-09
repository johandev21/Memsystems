import type {
  StudyGuideGenerationOptions,
  CaseStudyGenerationOptions,
} from "@/features/study-material-viewer";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GatewayKeyPrompt, isConnectionUsable, useConnectionStatus } from "@/features/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModelPersistence } from "@/features/notebooks";
import { useGenerationStore } from "../hooks/use-generation-store";
import { KIND_LABELS, type StudyMaterialKind } from "@/features/study-material-viewer";
import type {
  RoadmapOptions,
  MindMapOptions,
  SlidesOptions,
  PracticeProblemsOptions,
} from "./forms/types";
import { DEFAULT_ROADMAP_OPTIONS } from "./forms/roadmap-options";
import { DEFAULT_SLIDES_OPTIONS } from "./forms/slides-theme-options";
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

  const { value, updateBriefForm, resetAfterSubmit } = useGenerationBriefState(kind);
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
    studyGuideOptions,
    practiceProblemsOptions,
    caseStudyOptions,
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
        roadmapOptions:
          kind === "roadmap" ? (roadmapOptions ?? DEFAULT_ROADMAP_OPTIONS) : roadmapOptions,
        mindMapOptions,
        slidesOptions:
          kind === "slides" ? (slidesOptions ?? DEFAULT_SLIDES_OPTIONS) : slidesOptions,
        studyGuideOptions,
        practiceProblemsOptions,
        caseStudyOptions,
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
          "max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden",
          "min-w-0 [&>*]:min-w-0",
          "sm:max-w-md",
          (kind === "quiz" ||
            kind === "simple_flashcard" ||
            kind === "study_guide" ||
            kind === "practice_problems" ||
            kind === "case_study" ||
            kind === "roadmap" ||
            kind === "mind_map" ||
            kind === "slides") &&
            "sm:max-w-2xl",
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

function getInitialBriefState(kind?: StudyMaterialKind | null) {
  return {
    brief: "",
    sourceIds: [] as string[],
    folderId: null as string | null,
    questionCount: 10,
    difficulty: "medium" as const,
    roadmapOptions: kind === "roadmap" ? { ...DEFAULT_ROADMAP_OPTIONS } : undefined,
    slidesOptions: kind === "slides" ? { ...DEFAULT_SLIDES_OPTIONS } : undefined,
  };
}

function useGenerationBriefState(kind?: StudyMaterialKind | null) {
  const [prevKind, setPrevKind] = useState(kind);
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
    studyGuideOptions?: StudyGuideGenerationOptions;
    practiceProblemsOptions?: PracticeProblemsOptions;
    caseStudyOptions?: CaseStudyGenerationOptions;
  }>(() => getInitialBriefState(kind));

  if (prevKind !== kind) {
    setPrevKind(kind);
    setValue(getInitialBriefState(kind));
  }

  const updateBriefForm = (next: Partial<typeof value>) =>
    setValue((current) => ({ ...current, ...next }));
  const resetAfterSubmit = () => setValue(getInitialBriefState(kind));

  return { value, updateBriefForm, resetAfterSubmit };
}

