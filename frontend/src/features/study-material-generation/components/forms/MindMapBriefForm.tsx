import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import type { BaseMaterialFormProps } from "./types";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import { GenerationSourcePopover } from "./generation-source-popover";

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

export function MindMapBriefForm({
  notebookId,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Mind Map",
  disabled = false,
}: BaseMaterialFormProps) {
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
  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  useEffect(() => {
    onChange({
      mindMapOptions: {
        nodeCount: isAutoMode ? 0 : nodeCount,
        structure: "hierarchical",
        colorGroups,
        crossLinks: false,
        detailLevel,
      },
    });
    // The dialog's update callback is recreated with each parent render.
    // These local option values are the effect's actual dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorGroups, detailLevel, isAutoMode, nodeCount]);

  const handleCustomChange = (raw: string) => {
    setCustomValue(raw);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setNodeCount(Math.min(MAX_NODE_COUNT, Math.max(1, parsed)));
    }
  };

  const handleCustomBlur = () => {
    const parsed = Number.parseInt(customValue, 10);
    const nextValue = Number.isNaN(parsed) ? 40 : Math.min(MAX_NODE_COUNT, Math.max(1, parsed));
    setCustomValue(String(nextValue));
    setNodeCount(nextValue);
  };

  const mapSizeLabel = isAutoMode
    ? "Auto (AI decides)"
    : `${nodeCount} nodes${nodeCount >= MAX_NODE_COUNT ? " (max 100)" : ""}`;

  return (
    <div className="flex w-full flex-col gap-4 font-sans text-text-tertiary">
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
        }}
        onPreset={(count) => {
          setIsAutoMode(false);
          setIsCustomMode(false);
          setNodeCount(count);
        }}
        onCustom={() => {
          setIsAutoMode(false);
          setIsCustomMode(true);
          setNodeCount(
            Math.min(MAX_NODE_COUNT, Math.max(1, Number.parseInt(customValue, 10) || 40)),
          );
        }}
        onCustomChange={handleCustomChange}
        onCustomBlur={handleCustomBlur}
      />

      <OptionCards
        label="Detail Level"
        options={DETAIL_OPTIONS}
        selectedId={detailLevel}
        onSelect={setDetailLevel}
      />
      <OptionCards
        label="Color Groups"
        options={COLOR_OPTIONS}
        selectedId={colorGroups}
        onSelect={setColorGroups}
      />

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-text-primary">
          Knowledge Sources{!hasInstructions && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <GenerationSourcePopover
          sources={sources}
          selectedIds={value.sourceIds}
          onChange={(sourceIds) => onChange({ sourceIds })}
          emptyMessage="No sources in notebook. Mind map will generate using general knowledge."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brief-mindmap" className="text-sm font-medium text-text-primary">
          Custom Instructions{!hasSources && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <Textarea
          id="brief-mindmap"
          value={value.brief}
          onChange={(event) => onChange({ brief: event.target.value })}
          placeholder="What should this map explain? Describe the topic, question, or connections..."
          className="min-h-[70px] max-h-[180px] w-full resize-none text-xs"
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-text-tertiary">Destination Folder</Label>
        <FolderPicker
          notebookId={notebookId}
          value={value.folderId}
          onChange={(folderId) => onChange({ folderId })}
          disabled={disabled}
        />
      </div>

      <Button
        type="button"
        className={cn("mt-1 h-10 w-full gap-2 rounded-full text-sm font-medium", CTA_BUTTON_CLASS)}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </div>
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
        <Label className="text-sm font-medium text-text-primary">Map Size</Label>
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
