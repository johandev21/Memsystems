import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BriefChoiceField } from "./brief-choice-field";
import { BriefInstructionsStep } from "./brief-instructions-step";
import {
  BriefFieldLabel,
  BriefNextButton,
  BriefStep,
  BriefStepFields,
  BriefStepFooter,
  BriefStepHint,
} from "./brief-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CountSelector } from "./count-selector";
import { GenerationSourcePopover } from "./generation-source-popover";
import {
  CUSTOM_NODE_DEFAULT,
  DEFAULT_MIND_MAP_OPTIONS,
  MAX_NODE_COUNT,
  NODE_PRESETS,
} from "./mind-map-options";
import type { BaseMaterialFormProps, MindMapOptions } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

const TOTAL_STEPS = 2;

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
    useBriefWizard({ notebookId, value, onChange, disabled, totalSteps: TOTAL_STEPS });

  const currentOptions = value.mindMapOptions ?? DEFAULT_MIND_MAP_OPTIONS;
  const nodeCount = currentOptions.nodeCount || DEFAULT_MIND_MAP_OPTIONS.nodeCount;
  const rawDetailLevel = currentOptions.detailLevel as string;
  const detailLevel = (rawDetailLevel === "auto" ? "basic" : rawDetailLevel) as "basic" | "detailed";

  const updateMindMapOptions = (patch: Partial<MindMapOptions>) => {
    onChange({
      mindMapOptions: {
        nodeCount: patch.nodeCount ?? nodeCount,
        structure: "hierarchical",
        colorGroups: false,
        crossLinks: false,
        detailLevel: patch.detailLevel ?? detailLevel,
      },
    });
  };

  const detailOptions = [
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

  const mapSizeLabel =
    nodeCount >= MAX_NODE_COUNT
      ? t("mindMap.nodeCountMax", { count: nodeCount, max: MAX_NODE_COUNT })
      : t("mindMap.nodeCount", { count: nodeCount });

  return (
    <div className="flex flex-1 flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader
        title={t("wizard.title", { kind: t("kinds.mind_map") })}
        step={step}
        totalSteps={TOTAL_STEPS}
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
              columns={2}
              label={t("fields.detailLevelStep2")}
              options={detailOptions}
              value={detailLevel}
              onChange={(next) => updateMindMapOptions({ detailLevel: next })}
            />

            <div className="flex flex-col gap-2">
              <BriefFieldLabel required={!hasInstructions}>
                {t("fields.knowledgeSourcesStep3")}
              </BriefFieldLabel>
              <GenerationSourcePopover
                sources={sources}
                selectedIds={value.sourceIds}
                onChange={(sourceIds) => patchFormData({ sourceIds })}
                emptyMessage={t("knowledge.emptySources", { kind: t("kinds.mind_map") })}
              />
            </div>
          </BriefStepFields>

          <BriefStepFooter>
            <BriefStepHint>{t("wizard.nextHintInstructions")}</BriefStepHint>
            <BriefNextButton onClick={() => setStep(2)}>
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
          onBack={() => setStep(1)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
