import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  GatewayKeyPrompt,
  isConnectionUsable,
  isStudyMaterialCapable,
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorModels,
  ModelSelectorTrigger,
  useConnectionStatus,
  useModelList,
  useModelsCatalog,
} from "@/features/ai";
import type { ModelOption } from "@/features/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModelPersistence } from "@/features/notebooks/hooks/use-model-persistence";
import { useNotebookGroundingMode } from "@/features/notebooks/model/grounding-mode";
import { useGenerationStore } from "../hooks/use-generation-store";
import type { StudyMaterialKind } from "@/features/study-material-viewer/types";
import { useTranslation } from "react-i18next";
import { kindLabelKey } from "../kind-label";
import type { BriefFormData } from "./forms/types";
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
  const { t } = useTranslation("generation");
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
    roadmapOptions,
    mindMapOptions,
    slidesOptions,
    studyGuideOptions,
    practiceProblemsOptions,
    caseStudyOptions,
  } = value;
  const { model: selectedModel, setModel } = useModelPersistence(notebookId);
  const groundingMode = useNotebookGroundingMode(notebookId);
  const { models, capabilitiesVerified } = useModelsCatalog();
  const activeModel = models.find((model) => model.id === selectedModel);
  const isCapable = isStudyMaterialCapable(activeModel, capabilitiesVerified);

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
        groundingMode,
        questionCount,
        difficulty,
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

  const label = t(kindLabelKey(kind));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "bg-surface-1 border border-surface-border generate-material-dialog",
          "max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden",
          "min-w-0 [&>*]:min-w-0",
          "sm:max-w-2xl",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-text-primary">
            {t("dialog.title", { kind: label })}
          </DialogTitle>
        </DialogHeader>
        {!isConnectionUsable(connection) ? (
          <GatewayKeyPrompt description={t("dialog.gatewayDescription")} />
        ) : isCapable ? (
          <BriefForm
            notebookId={notebookId}
            kind={kind}
            value={value}
            onChange={updateBriefForm}
            onSubmit={handleSubmit}
            submitLabel={t("actions.generate")}
            disabled={false}
          />
        ) : (
          <StudyMaterialCapabilityGate
            modelName={activeModel?.displayName ?? selectedModel}
            capabilitiesVerified={capabilitiesVerified}
            models={models}
            selectedModel={selectedModel}
            onSelect={setModel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface StudyMaterialCapabilityGateProps {
  modelName: string;
  capabilitiesVerified: boolean;
  models: ModelOption[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

/**
 * Blocks the brief form until the notebook's model can produce structured
 * output. The picker opens in place; choosing a capable model swaps this gate
 * for the form without adding a permanent selector to the dialog.
 */
function StudyMaterialCapabilityGate({
  modelName,
  capabilitiesVerified,
  models,
  selectedModel,
  onSelect,
}: StudyMaterialCapabilityGateProps) {
  const { t } = useTranslation("generation");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const groups = useModelList(models, { search, structuredOnly: true, capabilitiesVerified });

  return (
    <div className="py-4 space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("capabilityGate.title")}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          {capabilitiesVerified
            ? t("capabilityGate.description", { name: modelName })
            : t("capabilityGate.unverifiedDescription")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ModelSelector open={pickerOpen} onOpenChange={setPickerOpen}>
          <ModelSelectorTrigger render={<Button size="sm" />}>
            {t("capabilityGate.chooseModel")}
          </ModelSelectorTrigger>
          <ModelSelectorContent title={t("capabilityGate.pickerTitle")}>
            <ModelSelectorInput
              placeholder={t("capabilityGate.searchPlaceholder")}
              value={search}
              onValueChange={setSearch}
            />
            <ModelSelectorModels
              groups={groups}
              selectedModel={selectedModel}
              capabilitiesVerified={capabilitiesVerified}
              onSelect={(modelId) => {
                onSelect(modelId);
                setPickerOpen(false);
              }}
            />
          </ModelSelectorContent>
        </ModelSelector>
      </div>
    </div>
  );
}

/**
 * Every selector starts on an explicit default so users always choose
 * consciously. The backend still accepts legacy "auto"/0 values.
 */
function getInitialBriefState(kind?: StudyMaterialKind | null): BriefFormData {
  return {
    brief: "",
    sourceIds: [],
    folderId: null,
    questionCount: 10,
    difficulty: "medium",
    roadmapOptions: kind === "roadmap" ? { ...DEFAULT_ROADMAP_OPTIONS } : undefined,
    mindMapOptions:
      kind === "mind_map"
        ? {
            nodeCount: 20,
            structure: "hierarchical",
            colorGroups: true,
            crossLinks: false,
            detailLevel: "basic",
          }
        : undefined,
    slidesOptions: kind === "slides" ? { ...DEFAULT_SLIDES_OPTIONS } : undefined,
    studyGuideOptions: kind === "study_guide" ? { format: "detailed", sectionCount: 6 } : undefined,
    practiceProblemsOptions:
      kind === "practice_problems" ? { problemCount: 6, difficulty: "medium" } : undefined,
    caseStudyOptions:
      kind === "case_study" ? { questionCount: 4, focus: "", comparePerspectives: "single" } : undefined,
  };
}

function useGenerationBriefState(kind?: StudyMaterialKind | null) {
  const [prevKind, setPrevKind] = useState(kind);
  const [value, setValue] = useState<BriefFormData>(() => getInitialBriefState(kind));

  if (prevKind !== kind) {
    setPrevKind(kind);
    setValue(getInitialBriefState(kind));
  }

  const updateBriefForm = (next: Partial<BriefFormData>) =>
    setValue((current) => ({ ...current, ...next }));
  const resetAfterSubmit = () => setValue(getInitialBriefState(kind));

  return { value, updateBriefForm, resetAfterSubmit };
}
