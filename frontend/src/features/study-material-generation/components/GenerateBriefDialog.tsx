import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  GatewayKeyPrompt,
  isConnectionUsable,
  isStudyMaterialCapable,
  MobileModelSelectorDrawer,
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
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MODAL_POPOVER_LAYER, OverlayLayerContext } from "@/components/ui/overlay-layer";
import { useModelPersistence } from "@/features/notebooks/hooks/use-model-persistence";
import { useNotebookGroundingMode } from "@/features/notebooks/model/grounding-mode";
import { useGenerationStore } from "../hooks/use-generation-store";
import type { StudyMaterialKind } from "@/features/study-material-viewer/types";
import { useTranslation } from "react-i18next";
import { kindLabelKey } from "../kind-label";
import type { BriefFormData } from "./forms/types";
import { DEFAULT_MIND_MAP_OPTIONS } from "./forms/mind-map-options";
import { DEFAULT_ROADMAP_OPTIONS } from "./forms/roadmap-options";
import { DEFAULT_SLIDES_OPTIONS } from "./forms/slides-theme-options";
import { BriefForm } from "./BriefForm";
import { cn } from "@/shared/utils/cn";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

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
  const isMobile = useMediaQuery("(max-width: 639px)");
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
        mindMapOptions:
          kind === "mind_map" ? (mindMapOptions ?? DEFAULT_MIND_MAP_OPTIONS) : mindMapOptions,
        slidesOptions:
          kind === "slides" ? (slidesOptions ?? DEFAULT_SLIDES_OPTIONS) : slidesOptions,
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
  const titleText = t("dialog.title", { kind: label });

  const bodyContent = !isConnectionUsable(connection) ? (
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
  );

  if (isMobile) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            data-slot="mobile-fullscreen-backdrop"
            className="fixed inset-0 isolate z-modal-backdrop bg-black/40 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          />
          <DialogPrimitive.Popup
            data-slot="mobile-fullscreen-dialog"
            className={cn(
              "fixed inset-0 z-modal-content flex flex-col bg-surface-1 text-text-primary",
              "h-dvh w-screen overflow-hidden outline-none generate-material-dialog",
              "duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            )}
          >
            <OverlayLayerContext.Provider value={MODAL_POPOVER_LAYER}>
              <div className="flex h-13 shrink-0 items-center justify-between border-b border-surface-border px-4 pt-safe select-none">
                <DialogPrimitive.Title className="text-base font-semibold text-text-primary truncate">
                  {titleText}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  data-slot="mobile-fullscreen-close"
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-text-secondary hover:text-text-primary rounded-lg touch-manipulation active:scale-95 cursor-pointer"
                    />
                  }
                >
                  <XIcon className="size-4.5" />
                  <span className="sr-only">{t("dialog.close", "Close")}</span>
                </DialogPrimitive.Close>
              </div>

              <div className="flex-1 flex flex-col overflow-y-auto overscroll-contain px-4 py-4 min-w-0 pb-safe-lg">
                {bodyContent}
              </div>
            </OverlayLayerContext.Provider>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "bg-surface-1 border border-surface-border generate-material-dialog",
          "max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden",
          "min-w-0 [&>*]:min-w-0",
          "sm:max-w-xl sm:pb-6",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-text-primary">
            {titleText}
          </DialogTitle>
        </DialogHeader>
        {bodyContent}
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

function StudyMaterialCapabilityGate({
  modelName,
  capabilitiesVerified,
  models,
  selectedModel,
  onSelect,
}: StudyMaterialCapabilityGateProps) {
  const { t } = useTranslation("generation");
  const isMobile = useMediaQuery("(max-width: 639px)");
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
        {isMobile ? (
          <MobileModelSelectorDrawer
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            trigger={<Button size="sm">{t("capabilityGate.chooseModel")}</Button>}
            groups={groups}
            selectedModel={selectedModel}
            onSelect={(modelId) => {
              onSelect(modelId);
              setPickerOpen(false);
            }}
            search={search}
            onSearchChange={setSearch}
            title={t("capabilityGate.pickerTitle")}
            searchPlaceholder={t("capabilityGate.searchPlaceholder")}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}

function getInitialBriefState(kind?: StudyMaterialKind | null): BriefFormData {
  return {
    brief: "",
    sourceIds: [],
    folderId: null,
    questionCount: 10,
    difficulty: "medium",
    roadmapOptions: kind === "roadmap" ? { ...DEFAULT_ROADMAP_OPTIONS } : undefined,
    mindMapOptions: kind === "mind_map" ? { ...DEFAULT_MIND_MAP_OPTIONS } : undefined,
    slidesOptions: kind === "slides" ? { ...DEFAULT_SLIDES_OPTIONS } : undefined,
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
