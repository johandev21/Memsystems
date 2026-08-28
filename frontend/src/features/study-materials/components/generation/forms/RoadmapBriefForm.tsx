import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, Cpu, BookOpen, Globe, FileText } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { FolderPicker } from "@/features/notebooks";
import type { ModelOption } from "@/shared/api/models";
import { sourcesQueryOptions } from "@/shared/api/sources";
import { cn } from "@/shared/lib/utils";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";
import { GenerationModelPopover } from "./generation-model-popover";
import { GenerationSourcePopover } from "./generation-source-popover";

// ============================================================================
// Module Constants
// ============================================================================

type DetailLevel = "basic" | "detailed";

const PHASE_PRESETS = [3, 5, 7, 10];

const DETAIL_OPTIONS = [
  {
    id: "basic" as DetailLevel,
    title: "Basic",
    desc: "Phase titles & milestones only",
  },
  {
    id: "detailed" as DetailLevel,
    title: "Detailed",
    desc: "In-depth topics & learning objectives",
  },
] as const;

// ============================================================================
// Roadmap Brief Form Component
// ============================================================================

export function RoadmapBriefForm({
  notebookId,
  models,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Roadmap",
  disabled = false,
}: BaseMaterialFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const initialPhaseCount = value.roadmapOptions?.phaseCount ?? 5;
  const [phaseCount, setPhaseCount] = useState<number>(initialPhaseCount);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(initialPhaseCount === 0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    initialPhaseCount > 0 && !PHASE_PRESETS.includes(initialPhaseCount),
  );
  const [customVal, setCustomVal] = useState<string>(
    initialPhaseCount > 0 && !PHASE_PRESETS.includes(initialPhaseCount)
      ? String(initialPhaseCount)
      : "12",
  );

  const [detailLevel, setDetailLevel] = useState<DetailLevel>(
    value.roadmapOptions?.detailLevel ?? "detailed",
  );

  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const update = (patch: Partial<BriefFormData>) => {
    onChange({ ...value, ...patch });
  };

  useEffect(() => {
    update({
      roadmapOptions: {
        phaseCount: isAutoMode ? 0 : phaseCount,
        detailLevel,
      },
    });
  }, [phaseCount, isAutoMode, detailLevel]);

  const handleCustomChange = (raw: string) => {
    setCustomVal(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(50, Math.max(1, parsed));
      setPhaseCount(clamped);
    }
  };

  const handleCustomBlur = () => {
    let parsed = parseInt(customVal, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 5;
    if (parsed > 50) parsed = 50;
    setCustomVal(String(parsed));
    setPhaseCount(parsed);
  };

  const phaseLabel = isAutoMode
    ? "Auto (AI Decides optimal phases)"
    : `${phaseCount} ${phaseCount === 1 ? "Phase" : "Phases"}${phaseCount >= 50 ? " (Max 50)" : ""}`;

  return (
    <div className="flex flex-col gap-4 w-full font-sans text-text-tertiary animate-in fade-in duration-150">
      {/* Phase Count Selector */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium text-text-primary">Number of Phases</Label>
          <span className="text-xs font-medium text-primary">{phaseLabel}</span>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {/* Auto Mode button */}
          <button
            type="button"
            onClick={() => {
              setIsAutoMode(true);
              setIsCustomMode(false);
              setPhaseCount(0);
            }}
            className={cn(
              optionRowClass(isAutoMode),
              "h-9 text-xs text-center flex items-center justify-center gap-1",
              isAutoMode ? "font-semibold" : "font-medium",
            )}
          >
            Auto
          </button>

          {/* Presets */}
          {PHASE_PRESETS.map((cnt) => {
            const selected = !isAutoMode && !isCustomMode && phaseCount === cnt;
            return (
              <button
                key={cnt}
                type="button"
                onClick={() => {
                  setIsAutoMode(false);
                  setIsCustomMode(false);
                  setPhaseCount(cnt);
                }}
                className={cn(
                  optionRowClass(selected),
                  "h-9 text-xs text-center flex items-center justify-center gap-1",
                  selected ? "font-semibold" : "font-medium",
                )}
              >
                {cnt}
              </button>
            );
          })}

          {/* Custom Field Input / Button */}
          {isCustomMode && !isAutoMode ? (
            <div className="relative flex items-center h-9">
              <input
                type="number"
                min={1}
                max={50}
                value={customVal}
                onChange={(e) => handleCustomChange(e.target.value)}
                onBlur={handleCustomBlur}
                placeholder="1-50"
                className="w-full h-9 px-2 text-center text-xs font-semibold bg-surface-2 border border-primary text-text-primary rounded-2xl outline-none focus:ring-1 focus:ring-surface-border-strong shadow-2xs"
                autoFocus
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsAutoMode(false);
                setIsCustomMode(true);
                const parsed = parseInt(customVal, 10) || 12;
                setPhaseCount(Math.min(50, Math.max(1, parsed)));
              }}
              className={cn(
                optionRowClass(false),
                "h-9 text-xs font-medium text-center flex items-center justify-center",
              )}
            >
              Custom
            </button>
          )}
        </div>
      </div>

      {/* Detail Level */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-text-primary">Detail Level</Label>
        <div className="grid grid-cols-2 gap-2">
          {DETAIL_OPTIONS.map((opt) => {
            const selected = detailLevel === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setDetailLevel(opt.id)}
                className={cn(optionRowClass(selected), "p-3 flex items-start gap-3")}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        selected ? "text-text-secondary" : "text-text-tertiary",
                      )}
                    >
                      {opt.title}
                    </span>
                  </div>
                  <span className="text-xs text-text-faint leading-tight">{opt.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Knowledge Sources */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-text-primary">
          Knowledge Sources{!hasInstructions && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <GenerationSourcePopover
          sources={sources}
          selectedIds={value.sourceIds}
          onChange={(sourceIds) => update({ sourceIds })}
          emptyMessage="No sources in notebook. Roadmap will generate using general knowledge."
        />
      </div>

      {/* Custom Instructions */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brief-roadmap" className="text-sm font-medium text-text-primary">
          Custom Instructions{!hasSources && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Textarea
          id="brief-roadmap"
          ref={textareaRef}
          value={value.brief}
          onChange={(e) => update({ brief: e.target.value })}
          placeholder="What do you want to learn? Describe the topic, goal, or target skill..."
          className="min-h-[70px] max-h-[180px] text-xs resize-none break-all max-w-full overflow-x-hidden w-full"
          disabled={disabled}
        />
      </div>

      {/* Folder + Model */}
      <div className="grid grid-cols-2 gap-4 items-center">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-text-tertiary">Destination Folder</Label>
          <FolderPicker
            notebookId={notebookId}
            value={value.folderId}
            onChange={(folderId) => update({ folderId })}
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-text-tertiary">AI Intelligence Model</Label>
          <GenerationModelPopover
            models={models}
            selectedModel={value.model}
            onModelChange={(model) => update({ model })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="button"
        className={cn(
          "w-full h-10 rounded-full font-medium text-sm gap-2 cursor-pointer transition-colors mt-1",
          CTA_BUTTON_CLASS,
        )}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

// ============================================================================
// Roadmap Source Popover Component
// ============================================================================

export function RoadmapSourcePopover({
  sources,
  selectedIds,
  onChange,
}: {
  sources: Array<{ id: string; title: string; kind: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = sources.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id));

  const toggleAll = () => {
    if (allSelected) {
      const filteredSet = new Set(filtered.map((s) => s.id));
      onChange(selectedIds.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filtered.map((s) => s.id)]);
      onChange(Array.from(merged));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-2xl border border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3 hover:text-text-secondary text-xs font-medium gap-2 px-3.5 justify-between w-full"
          >
            <div className="flex items-center gap-2 truncate">
              <BookOpen className="size-4 text-primary shrink-0" />
              <span className="truncate">
                {selectedIds.length === 0
                  ? "None selected (General Knowledge)"
                  : `${selectedIds.length} source${selectedIds.length !== 1 ? "s" : ""} selected`}
              </span>
            </div>
            <ChevronDown className="size-4 text-text-faint shrink-0" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-[320px] p-0 bg-surface-1 border-surface-border shadow-xl rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-2">
          <div className="flex items-center gap-2 flex-1">
            <Search className="size-4 text-text-faint shrink-0" />
            <input
              type="text"
              placeholder="Search sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-text-tertiary placeholder:text-text-faint outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-2 pl-2">
            <span
              className="text-xs text-text-tertiary cursor-pointer select-none"
              onClick={toggleAll}
            >
              Select all
            </span>
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </div>
        </div>
        {sources.length === 0 ? (
          <div className="p-4 text-center text-xs text-text-faint">
            No sources in notebook. Roadmap will generate using general knowledge.
          </div>
        ) : (
          <div className="max-h-[220px] overflow-y-auto p-2 space-y-1">
            {filtered.map((src) => {
              const checked = selectedIds.includes(src.id);
              return (
                <div
                  key={src.id}
                  onClick={() => toggleOne(src.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors",
                    checked
                      ? "bg-surface-3 text-text-secondary font-medium"
                      : "hover:bg-surface-2 text-text-tertiary",
                  )}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {src.kind === "web" ? (
                      <Globe className="size-4 text-primary shrink-0" />
                    ) : src.kind === "file" ? (
                      <FileText className="size-4 text-primary shrink-0" />
                    ) : (
                      <BookOpen className="size-4 text-primary shrink-0" />
                    )}
                    <span className="truncate">{src.title}</span>
                  </div>
                  <Checkbox checked={checked} onCheckedChange={() => toggleOne(src.id)} />
                </div>
              );
            })}
          </div>
        )}
        <div className="p-2.5 bg-surface-2 flex justify-between items-center text-xs text-text-faint">
          <span>{selectedIds.length} selected</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Roadmap Model Popover Component
// ============================================================================

export function RoadmapModelPopover({
  models,
  selectedModel,
  onModelChange,
  disabled,
}: {
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}) {
  const selected = models.find((m) => m.id === selectedModel) ?? models[0];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-8 rounded-2xl border border-surface-border-subtle bg-surface-2 text-text-tertiary hover:bg-surface-3 hover:text-text-secondary text-xs font-medium gap-2 px-3.5 justify-between w-full"
          >
            <div className="flex items-center gap-2 truncate">
              <Cpu className="size-4 text-primary shrink-0" />
              <span className="truncate">
                {selected?.displayName || selectedModel || "Select Model"}
              </span>
            </div>
            <ChevronDown className="size-4 text-text-faint shrink-0" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="w-[280px] p-2 bg-surface-1 border-surface-border shadow-xl rounded-2xl"
      >
        <div className="px-2 py-1 text-xs font-medium text-text-faint">Select Model</div>
        <div className="space-y-1 mt-1">
          {models.map((m) => {
            const isSelected = m.id === selectedModel;
            return (
              <div
                key={m.id}
                onClick={() => onModelChange(m.id)}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-colors",
                  isSelected
                    ? "bg-surface-3 text-text-secondary font-semibold"
                    : "hover:bg-surface-2 text-text-tertiary",
                )}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{m.displayName}</span>
                  <span className="text-xs text-text-faint font-normal">{m.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
