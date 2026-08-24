import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronDown,
  Cpu,
  FileText,
  Globe,
  Search,
} from "lucide-react";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/shared/api/sources";
import type { ModelOption } from "@/shared/api/models";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import type { BaseMaterialFormProps, BriefFormData } from "./types";
import { CTA_BUTTON_CLASS, optionRowClass } from "./option-row";

type NodeCount = number;

const NODE_PRESETS = [10, 20, 30];
const MAX_NODE_COUNT = 100;

export function MindMapBriefForm({
  notebookId,
  models,
  value,
  onChange,
  onSubmit,
  submitLabel = "Generate Mind Map",
  disabled = false,
}: BaseMaterialFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialNodeCount = value.mindMapOptions?.nodeCount ?? 20;
  const [nodeCount, setNodeCount] = useState<NodeCount>(initialNodeCount);
  const [isAutoMode, setIsAutoMode] = useState(initialNodeCount === 0);
  const [isCustomMode, setIsCustomMode] = useState(
    initialNodeCount > 0 && !NODE_PRESETS.includes(initialNodeCount),
  );
  const [customValue, setCustomValue] = useState(
    initialNodeCount > 0 && !NODE_PRESETS.includes(initialNodeCount)
      ? String(initialNodeCount)
      : "40",
  );
  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));

  const hasSources = value.sourceIds.length > 0;
  const hasInstructions = value.brief.trim().length > 0;
  const canSubmit = !disabled && (hasSources || hasInstructions);

  const update = (patch: Partial<BriefFormData>) => onChange({ ...value, ...patch });

  useEffect(() => {
    // The viewer is intentionally a tree. Keep the API payload explicit while
    // avoiding controls for layouts the viewer does not render.
    update({
      mindMapOptions: {
        nodeCount,
        structure: "hierarchical",
        colorGroups: false,
        crossLinks: false,
      },
    });
  }, [nodeCount, isAutoMode]);

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
    <div className="flex w-full flex-col gap-5 font-sans text-text-tertiary">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Map size</Label>
          <span className="text-xs font-medium text-text-faint">{mapSizeLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button
            type="button"
            aria-pressed={isAutoMode}
            onClick={() => {
              setIsAutoMode(true);
              setIsCustomMode(false);
              setNodeCount(0);
            }}
            className={cn(
              optionRowClass(isAutoMode),
              "flex h-9 items-center justify-center gap-1.5 text-xs",
              isAutoMode ? "font-semibold" : "font-medium",
            )}
          >
            Auto
          </button>

          {NODE_PRESETS.map((count) => {
            const selected = !isAutoMode && !isCustomMode && nodeCount === count;
            return (
              <button
                key={count}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setIsAutoMode(false);
                  setIsCustomMode(false);
                  setNodeCount(count);
                }}
                className={cn(
                  optionRowClass(selected),
                  "flex h-9 items-center justify-center gap-1.5 text-xs",
                  selected ? "font-semibold" : "font-medium",
                )}
              >
                {count}
              </button>
            );
          })}

          {isCustomMode ? (
            <input
              type="number"
              min={1}
              max={MAX_NODE_COUNT}
              value={customValue}
              onChange={(event) => handleCustomChange(event.target.value)}
              onBlur={handleCustomBlur}
              placeholder="1-100"
              aria-label="Custom node count"
              className="h-9 w-full rounded-2xl border border-primary bg-surface-2 px-2 text-center text-xs font-semibold text-text-primary outline-none focus:ring-1 focus:ring-surface-border-strong"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsAutoMode(false);
                setIsCustomMode(true);
                setNodeCount(
                  Math.min(MAX_NODE_COUNT, Math.max(1, Number.parseInt(customValue, 10) || 40)),
                );
              }}
              className={cn(
                optionRowClass(false),
                "flex h-9 items-center justify-center text-xs font-medium",
              )}
            >
              Custom
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="brief-mindmap" className="text-sm font-medium text-text-primary">
            What should this map explain?
            {!hasSources && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
          <Textarea
            id="brief-mindmap"
            ref={textareaRef}
            value={value.brief}
            onChange={(event) => update({ brief: event.target.value })}
            placeholder="Describe the topic, question, or connections you want to understand..."
            className="min-h-[84px] resize-none text-xs"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label className="text-sm font-medium text-text-primary">
            Knowledge sources
            {!hasInstructions && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
          <MindMapSourcePopover
            sources={sources}
            selectedIds={value.sourceIds}
            onChange={(sourceIds) => update({ sourceIds })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-text-tertiary">Destination folder</Label>
          <FolderPicker
            notebookId={notebookId}
            value={value.folderId}
            onChange={(folderId) => update({ folderId })}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-text-tertiary">AI model</Label>
          <MindMapModelPopover
            models={models}
            selectedModel={value.model}
            onModelChange={(model) => update({ model })}
            disabled={disabled}
          />
        </div>
      </div>

      <Button
        type="button"
        className={cn(
          "h-10 w-full gap-2 rounded-full text-sm font-medium transition-colors",
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

function MindMapSourcePopover({
  sources,
  selectedIds,
  onChange,
}: {
  sources: Array<{ id: string; title: string; kind: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = sources.filter((source) =>
    source.title.toLowerCase().includes(search.toLowerCase()),
  );
  const allSelected =
    filtered.length > 0 && filtered.every((source) => selectedIds.includes(source.id));

  const toggleAll = () => {
    if (allSelected) {
      const filteredIds = new Set(filtered.map((source) => source.id));
      onChange(selectedIds.filter((id) => !filteredIds.has(id)));
    } else {
      onChange(Array.from(new Set([...selectedIds, ...filtered.map((source) => source.id)])));
    }
  };

  const toggleOne = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 rounded-2xl border border-surface-border-subtle bg-surface-2 text-text-tertiary px-3.5 text-xs font-medium hover:bg-surface-3 hover:text-text-secondary"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <BookOpen className="size-4 shrink-0 text-primary" />
              <span className="truncate">
                {selectedIds.length === 0
                  ? "General knowledge"
                  : `${selectedIds.length} source${selectedIds.length === 1 ? "" : "s"} selected`}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-text-faint" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[320px] overflow-hidden rounded-2xl border border-surface-border bg-surface-1 p-0 shadow-xl">
        <div className="flex items-center justify-between bg-surface-2 px-3.5 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Search className="size-4 shrink-0 text-text-faint" />
            <input
              type="text"
              placeholder="Search sources..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="ml-2 flex shrink-0 cursor-pointer items-center gap-2 text-xs text-text-tertiary"
          >
            Select all <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </button>
        </div>
        {sources.length === 0 ? (
          <div className="p-4 text-center text-xs text-text-faint">
            No sources in notebook. General knowledge will be used.
          </div>
        ) : (
          <div className="max-h-[220px] space-y-1 overflow-y-auto p-2">
            {filtered.map((source) => {
              const checked = selectedIds.includes(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => toggleOne(source.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs",
                    checked
                      ? "bg-surface-3 font-medium text-text-secondary"
                      : "text-text-tertiary hover:bg-surface-2",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate pr-2">
                    {source.kind === "web" ? (
                      <Globe className="size-4 shrink-0 text-primary" />
                    ) : source.kind === "file" ? (
                      <FileText className="size-4 shrink-0 text-primary" />
                    ) : (
                      <BookOpen className="size-4 shrink-0 text-primary" />
                    )}
                    <span className="truncate">{source.title}</span>
                  </span>
                  <Checkbox checked={checked} onCheckedChange={() => toggleOne(source.id)} />
                </button>
              );
            })}
          </div>
        )}
        <div className="bg-surface-2 p-2.5 text-xs text-text-faint">
          {selectedIds.length} selected
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MindMapModelPopover({
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
  const selected = models.find((model) => model.id === selectedModel) ?? models[0];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-9 w-full justify-between gap-2 rounded-2xl border border-surface-border-subtle bg-surface-2 text-text-tertiary px-3.5 text-xs font-medium hover:bg-surface-3 hover:text-text-secondary"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <Cpu className="size-4 shrink-0 text-primary" />
              <span className="truncate">
                {selected?.displayName || selectedModel || "Select model"}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-text-faint" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[280px] rounded-2xl border border-surface-border bg-surface-1 p-2 shadow-xl">
        <div className="px-2 py-1 text-xs font-medium text-text-faint">Select model</div>
        <div className="mt-1 space-y-1">
          {models.map((model) => {
            const isSelected = model.id === selectedModel;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onModelChange(model.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-xl p-2.5 text-left text-xs",
                  isSelected
                    ? "bg-surface-3 font-semibold text-text-secondary"
                    : "text-text-tertiary hover:bg-surface-2",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{model.displayName}</span>
                  <span className="text-xs font-normal text-text-faint">{model.id}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
