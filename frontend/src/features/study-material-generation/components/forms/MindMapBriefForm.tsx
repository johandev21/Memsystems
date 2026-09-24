import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefInstructionsStep } from "./brief-instructions-step";
import {
  BriefBackButton,
  BriefNextButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefStepHint,
} from "./brief-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CountSelector } from "./count-selector";
import { GenerationSourcePopover } from "./generation-source-popover";
import type { BaseMaterialFormProps, MindMapOptions } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

type GroupingId = "auto" | "plain" | "grouped";

const NODE_PRESETS = [10, 20, 30];
const MAX_NODE_COUNT = 100;
const CUSTOM_NODE_DEFAULT = 40;

const DEFAULT_MIND_MAP_OPTIONS: MindMapOptions = {
  nodeCount: 0,
  structure: "hierarchical",
  colorGroups: "auto",
  crossLinks: false,
  detailLevel: "auto",
};

export function MindMapBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel,
  disabled = false,
}: BaseMaterialFormProps) {
  const { t } = useTranslation("generation");
  const { step, setStep, sources, hasSources, hasInstructions, canSubmit, patchFormData } =
    useBriefWizard({ notebookId, value, onChange, disabled, totalSteps: 3 });

  const currentOptions = value.mindMapOptions ?? DEFAULT_MIND_MAP_OPTIONS;
  const nodeCount = currentOptions.nodeCount;
  const detailLevel = currentOptions.detailLevel;
  const storedColorGroups = currentOptions.colorGroups;
  const colorGroupsId: GroupingId =
    storedColorGroups === "auto" ? "auto" : storedColorGroups ? "grouped" : "plain";

  const updateMindMapOptions = (patch: Partial<MindMapOptions>) => {
    onChange({
      mindMapOptions: {
        nodeCount: patch.nodeCount ?? nodeCount,
        structure: "hierarchical",
        colorGroups: patch.colorGroups !== undefined ? patch.colorGroups : storedColorGroups,
        crossLinks: false,
        detailLevel: patch.detailLevel ?? detailLevel,
      },
    });
  };

  const detailOptions = [
    { id: "auto" as const, title: t("actions.auto"), desc: t("options.auto.description") },
    {
      id: "basic" as const,
      title: t("mindMap.detail.basic.title"),
      desc: t("mindMap.detail.basic.desc"),
    },
    {
      id: "detailed" as const,
      title: t("mindMap.detail.detailed.title"),
      desc: t("mindMap.detail.detailed.desc"),
    },
  ];

  const groupingOptions = [
    { id: "auto" as const, title: t("actions.auto"), desc: t("options.auto.description") },
    {
      id: "plain" as const,
      title: t("mindMap.colorGroups.plain.title"),
      desc: t("mindMap.colorGroups.plain.desc"),
    },
    {
      id: "grouped" as const,
      title: t("mindMap.colorGroups.grouped.title"),
      desc: t("mindMap.colorGroups.grouped.desc"),
    },
  ];

  const mapSizeLabel =
    nodeCount === 0
      ? t("actions.autoDecides")
      : nodeCount >= MAX_NODE_COUNT
        ? t("mindMap.nodeCountMax", { count: nodeCount, max: MAX_NODE_COUNT })
        : t("mindMap.nodeCount", { count: nodeCount });

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.mind_map") })}
        step={step}
        totalSteps={3}
        onStepChange={setStep}
      />
      {step === 1 ? (
        <BriefStep>
          <BriefStepFields>
            <CountSelector
              label={t("mindMap.mapSizeLabel")}
              summary={mapSizeLabel}
              value={nodeCount}
              presets={NODE_PRESETS}
              min={1}
              max={MAX_NODE_COUNT}
              customDefault={CUSTOM_NODE_DEFAULT}
              customAriaLabel={t("mindMap.customCountAria")}
              onValueChange={(next) => updateMindMapOptions({ nodeCount: next })}
            />

            <BriefChoiceField
              columns={3}
              label={t("fields.detailLevelStep2")}
              options={detailOptions}
              value={detailLevel}
              onChange={(next) => updateMindMapOptions({ detailLevel: next })}
            />
          </BriefStepFields>

          <BriefStepFooter>
            <BriefStepHint>{t("wizard.nextHintOptions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(2)}>
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </BriefNextButton>
          </BriefStepFooter>
        </BriefStep>
      ) : step === 2 ? (
        <BriefStep>
          <BriefStepFields>
            <BriefChoiceField
              columns={3}
              label={t("mindMap.visualGroupingLabel")}
              options={groupingOptions}
              value={colorGroupsId}
              onChange={(id) =>
                updateMindMapOptions({ colorGroups: id === "auto" ? "auto" : id === "grouped" })
              }
            />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-text-primary">
                {t("fields.knowledgeSourcesStep4")}
                {!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.mind_map") })}
              />
            </div>
          </BriefStepFields>

          <BriefStepFooter>
            <BriefBackButton onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" />
              {t("actions.back")}
            </BriefBackButton>
            <BriefStepHint>{t("wizard.nextHintInstructions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(3)}>
              {t("actions.nextStep")}
              <ArrowRight className="size-4" />
            </BriefNextButton>
          </BriefStepFooter>
        </BriefStep>
      ) : (
        <BriefInstructionsStep
          notebookId={notebookId}
          brief={value.brief}
          folderId={value.folderId}
          hasSources={hasSources}
          canSubmit={canSubmit}
          submitLabel={submitLabel ?? t("actions.generateKind", { kind: t("kinds.mind_map") })}
          placeholder={t("mindMap.instructionsPlaceholder")}
          textareaId="brief-mindmap"
          disabled={disabled}
          onBriefChange={(brief) => patchFormData({ brief })}
          onFolderIdChange={(folderId) => patchFormData({ folderId })}
          onBack={() => setStep(2)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
