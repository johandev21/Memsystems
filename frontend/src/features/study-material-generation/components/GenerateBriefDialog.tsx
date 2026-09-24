import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  GatewayKeyPrompt,
  isConnectionUsable,
  isStudyMaterialCapable,
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorFilter,
  ModelSelectorInput,
  ModelSelectorModels,
  ModelSelectorTrigger,
  useConnectionStatus,
  useModelList,
  useModelsCatalog,
} from "@/features/ai";
import type { ModelOption } from "@/features/ai";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useModelPersistence } from "@/features/notebooks/hooks/use-model-persistence";
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
    cardStyle,
    roadmapOptions,
    mindMapOptions,
    slidesOptions,
    studyGuideOptions,
    practiceProblemsOptions,
    caseStudyOptions,
  } = value;
  const { model: selectedModel, setModel } = useModelPersistence(notebookId);
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
  const [structuredOnly, setStructuredOnly] = useState(false);
  const groups = useModelList(models, { search, structuredOnly, capabilitiesVerified });

  return (
    <Alert>
      <AlertTitle>{t("capabilityGate.title")}</AlertTitle>
      <AlertDescription>
        {capabilitiesVerified
          ? t("capabilityGate.description", { name: modelName })
          : t("capabilityGate.unverifiedDescription")}
      </AlertDescription>
      <div className="mt-3 flex flex-wrap items-center gap-3">
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
            <ModelSelectorFilter checked={structuredOnly} onCheckedChange={setStructuredOnly} />
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
        {!capabilitiesVerified && (
          <a
            href="/settings"
            className="text-xs font-medium text-muted-foreground underline underline-offset-3 transition-colors hover:text-foreground"
          >
            {t("capabilityGate.refreshCatalog")}
          </a>
        )}
      </div>
    </Alert>
  );
}

/**
 * Every selector starts on "Auto": the model chooses from the selected
 * sources and the brief. Counts use 0 and enum options use "auto".
 */
function getInitialBriefState(kind?: StudyMaterialKind | null): BriefFormData {
  return {
    brief: "",
    sourceIds: [],
    folderId: null,
    questionCount: 0,
    difficulty: "auto",
    cardStyle: "auto",
    roadmapOptions: kind === "roadmap" ? { ...DEFAULT_ROADMAP_OPTIONS } : undefined,
    mindMapOptions:
      kind === "mind_map"
        ? {
            nodeCount: 0,
            structure: "hierarchical",
            colorGroups: "auto",
            crossLinks: false,
            detailLevel: "auto",
          }
        : undefined,
    slidesOptions: kind === "slides" ? { ...DEFAULT_SLIDES_OPTIONS } : undefined,
    studyGuideOptions: kind === "study_guide" ? { format: "auto", sectionCount: 0 } : undefined,
    practiceProblemsOptions:
      kind === "practice_problems" ? { problemCount: 0, difficulty: "auto" } : undefined,
    caseStudyOptions:
      kind === "case_study" ? { questionCount: 0, focus: "", comparePerspectives: "auto" } : undefined,
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
