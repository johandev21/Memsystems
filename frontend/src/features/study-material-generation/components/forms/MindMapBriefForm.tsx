import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";
import { ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BriefKnowledgeStep } from "./brief-knowledge-step";
import { BriefWizardHeader } from "./brief-wizard-header";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import type { BaseMaterialFormProps, MindMapOptions } from "./types";
import { useBriefWizard } from "./use-brief-wizard";

type DetailLevel = "basic" | "detailed";

const NODE_PRESETS = [10, 20, 30];
const MAX_NODE_COUNT = 100;
const DETAIL_OPTIONS = [
  { id: "basic" as DetailLevel, title: "Basic", desc: "Key concepts and essential relationships" },
  {
    id: "detailed" as DetailLevel,
    title: "Detailed",
    desc: "Richer labels and explanatory connections",
  },
] as const;
const COLOR_OPTIONS = [
  { id: false, title: "Plain", desc: "Use the standard node appearance" },
  { id: true, title: "Grouped colors", desc: "Color related concepts by theme" },
] as const;

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        optionRowClass(selected),
        "flex h-9 items-center justify-center text-xs",
        selected ? "font-semibold" : "font-medium",
      )}
    >
      {children}
    </button>
  );
}

function NodeCountSelector({
  nodeCount,
  isAutoMode,
  isCustomMode,
  customValue,
  label,
  onAuto,
  onPreset,
  onCustom,
  onCustomChange,
  onCustomBlur,
}: {
  nodeCount: number;
  isAutoMode: boolean;
  isCustomMode: boolean;
  customValue: string;
  label: string;
  onAuto: () => void;
  onPreset: (count: number) => void;
  onCustom: () => void;
  onCustomChange: (value: string) => void;
  onCustomBlur: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-text-primary">1. Map Size</Label>
        <span className="text-xs font-medium text-primary">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <OptionButton selected={isAutoMode} onClick={onAuto}>
          Auto
        </OptionButton>
        {NODE_PRESETS.map((count) => (
          <OptionButton
            key={count}
            selected={!isAutoMode && !isCustomMode && nodeCount === count}
            onClick={() => onPreset(count)}
          >
            {count}
          </OptionButton>
        ))}
        {isCustomMode ? (
          <input
            type="number"
            min={1}
            max={MAX_NODE_COUNT}
            value={customValue}
            onChange={(event) => onCustomChange(event.target.value)}
            onBlur={onCustomBlur}
            placeholder="1-100"
            aria-label="Custom node count"
            className="h-9 w-full rounded-2xl border border-primary bg-surface-2 px-2 text-center text-xs font-semibold text-text-primary outline-none focus:ring-1 focus:ring-surface-border-strong"
            autoFocus
          />
        ) : (
          <OptionButton selected={false} onClick={onCustom}>
            Custom
          </OptionButton>
        )}
      </div>
    </div>
  );
}

function OptionCards<T extends string | boolean>({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: readonly { id: T; title: string; desc: string }[];
  selectedId: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-text-primary">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = selectedId === option.id;
          return (
            <button
              key={String(option.id)}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(option.id)}
              className={cn(
                optionRowClass(selected),
                "flex min-h-[62px] items-start p-3 text-left",
              )}
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{option.title}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-xs leading-tight",
                    selected ? "opacity-80" : "text-text-faint",
                  )}
                >
                  {option.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MindMapBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Mind Map",
  disabled = false,
}: BaseMaterialFormProps) {
  const { step, setStep, sources, hasSources, hasInstructions, canSubmit, patchFormData } =
    useBriefWizard({ notebookId, value, onChange, disabled });

  const initialNodeCount = value.mindMapOptions?.nodeCount ?? 20;
  const [nodeCount, setNodeCount] = useState(initialNodeCount);
  const [isAutoMode, setIsAutoMode] = useState(initialNodeCount === 0);
  const [isCustomMode, setIsCustomMode] = useState(
    initialNodeCount > 0 && !NODE_PRESETS.includes(initialNodeCount),
  );
  const [customValue, setCustomValue] = useState(
    initialNodeCount > 0 && !NODE_PRESETS.includes(initialNodeCount)
      ? String(initialNodeCount)
      : "40",
  );
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(
    value.mindMapOptions?.detailLevel ?? "detailed",
  );
  const [colorGroups, setColorGroups] = useState(value.mindMapOptions?.colorGroups ?? false);

  const updateMindMapOptions = (patch: Partial<MindMapOptions>) => {
    const nextCount =
      patch.nodeCount !== undefined ? patch.nodeCount : isAutoMode ? 0 : nodeCount;
    const nextDetail = patch.detailLevel ?? detailLevel;
    const nextColor = patch.colorGroups !== undefined ? patch.colorGroups : colorGroups;
    onChange({
      mindMapOptions: {
        nodeCount: nextCount,
        structure: "hierarchical",
        colorGroups: nextColor,
        crossLinks: false,
        detailLevel: nextDetail,
      },
    });
  };

  const handleCustomChange = (raw: string) => {
    setCustomValue(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const next = Math.min(MAX_NODE_COUNT, Math.max(1, parsed));
      setNodeCount(next);
      updateMindMapOptions({ nodeCount: next });
    }
  };

  const handleCustomBlur = () => {
    const parsed = Number.parseInt(customValue, 10);
    const nextValue = Number.isNaN(parsed) ? 40 : Math.min(MAX_NODE_COUNT, Math.max(1, parsed));
    setCustomValue(String(nextValue));
    setNodeCount(nextValue);
    updateMindMapOptions({ nodeCount: nextValue });
  };

  const mapSizeLabel = isAutoMode
    ? "Auto (AI decides)"
    : `${nodeCount} nodes${nodeCount >= MAX_NODE_COUNT ? " (max 100)" : ""}`;

  return (
    <div className="flex flex-col gap-5 font-sans text-text-tertiary">
      <BriefWizardHeader title="Mind Map Setup" step={step} onStepChange={setStep} />
      {step === 1 ? (
        <div className="flex min-h-[380px] flex-col justify-between gap-5 animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="flex flex-col gap-5">
            <NodeCountSelector
              nodeCount={nodeCount}
              isAutoMode={isAutoMode}
              isCustomMode={isCustomMode}
              customValue={customValue}
              label={mapSizeLabel}
              onAuto={() => {
                setIsAutoMode(true);
                setIsCustomMode(false);
                setNodeCount(0);
                updateMindMapOptions({ nodeCount: 0 });
              }}
              onPreset={(count) => {
                setIsAutoMode(false);
                setIsCustomMode(false);
                setNodeCount(count);
                updateMindMapOptions({ nodeCount: count });
              }}
              onCustom={() => {
                setIsAutoMode(false);
                setIsCustomMode(true);
                const count = Math.min(
                  MAX_NODE_COUNT,
                  Math.max(1, Number.parseInt(customValue, 10) || 40),
                );
                setNodeCount(count);
                updateMindMapOptions({ nodeCount: count });
              }}
              onCustomChange={handleCustomChange}
              onCustomBlur={handleCustomBlur}
            />

            <OptionCards
              label="2. Detail Level"
              options={DETAIL_OPTIONS}
              selectedId={detailLevel}
              onSelect={(level) => {
                setDetailLevel(level);
                updateMindMapOptions({ detailLevel: level });
              }}
            />

            <OptionCards
              label="3. Visual Grouping"
              options={COLOR_OPTIONS}
              selectedId={colorGroups}
              onSelect={(color) => {
                setColorGroups(color);
                updateMindMapOptions({ colorGroups: color });
              }}
            />
          </div>

          <div className="flex items-center justify-between border-t border-transparent pt-2">
            <span className="text-xs text-text-faint">Configure custom instructions next</span>
            <Button
              type="button"
              onClick={() => {
                updateMindMapOptions({});
                setStep(2);
              }}
              className={cn(
                "h-9 gap-1.5 rounded-full px-5 text-sm font-medium transition-colors cursor-pointer",
                CTA_BUTTON_CLASS,
              )}
            >
              Next Step
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <BriefKnowledgeStep
          notebookId={notebookId}
          value={value}
          sources={sources}
          hasSources={hasSources}
          hasInstructions={hasInstructions}
          canSubmit={canSubmit}
          submitLabel={submitLabel}
          disabled={disabled}
          placeholder="What should this map explain? Describe the topic, question, or connections..."
          textareaId="brief-mindmap"
          emptySourcesMessage="No sources in notebook. Mind map will generate using general knowledge."
          onPatch={patchFormData}
          onBack={() => setStep(1)}
          onSubmit={() => {
            updateMindMapOptions({});
            onSubmit();
          }}
        />
      )}
    </div>
  );
}
