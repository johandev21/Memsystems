import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronDown,
  Cpu,
  FileText,
  GitBranch,
  Globe,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { FolderPicker } from "@/features/notebooks";
import { sourcesQueryOptions } from "@/shared/api/sources";
import type { ModelOption } from "@/shared/api/models";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import type { BaseMaterialFormProps, BriefFormData } from "./types";

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
    <div className="flex w-full flex-col gap-5 font-sans text-foreground">
      <section className="rounded-2xl border border-border bg-muted p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">A clear path through the topic</h3>
            </div>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Generate an expandable hierarchy you can explore one branch at a time.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1 text-xs">
            <GitBranch className="size-3" /> Tree view
          </Badge>
        </div>
        <TreePreview />
      </section>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Map size</Label>
          <span className="text-xs font-medium text-muted-foreground">{mapSizeLabel}</span>
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
              "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors",
              isAutoMode
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : "border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Wand2 className="size-3.5" /> Auto
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
                  "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary font-semibold text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {selected && <Check className="size-3" />}
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
              className="h-9 w-full rounded-xl border border-primary bg-card px-2 text-center text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/40"
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
              className="flex h-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-muted text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Custom
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="brief-mindmap" className="text-sm font-medium">
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
          <Label className="text-sm font-medium">
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
          <Label className="text-xs font-medium text-muted-foreground">Destination folder</Label>
          <FolderPicker
            notebookId={notebookId}
            value={value.folderId}
            onChange={(folderId) => update({ folderId })}
            disabled={disabled}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">AI model</Label>
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
        className="h-10 w-full gap-2 rounded-full border border-border/80 bg-panel-header-bg text-foreground text-sm font-medium shadow-md transition-colors hover:bg-muted disabled:bg-muted disabled:text-foreground disabled:opacity-100"
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        <Sparkles className="size-4" />
        {submitLabel}
      </Button>
    </div>
  );
}

function TreePreview() {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card px-3 py-5 sm:px-8">
      <div className="flex min-w-[420px] items-center justify-center gap-4">
        <div className="relative flex h-12 w-32 items-center justify-center rounded-full bg-primary px-3 text-center text-xs font-semibold text-primary-foreground shadow-sm">
          Core concept
          <span className="absolute -right-5 h-px w-5 bg-border" />
        </div>
        <div className="relative flex flex-col gap-3">
          <span className="absolute -left-4 top-6 h-12 w-px bg-border" />
          {[
            ["Main idea", "Key detail"],
            ["Related idea", "Example"],
            ["Practical use", "Takeaway"],
          ].map(([title, detail]) => (
            <div key={title} className="relative flex items-center gap-2">
              <span className="absolute -left-4 h-px w-4 bg-border" />
              <div className="flex h-9 w-28 items-center rounded-lg border border-border bg-background px-2.5 text-xs font-semibold">
                {title}
              </div>
              <span className="h-px w-4 bg-border" />
              <div className="flex h-8 w-24 items-center rounded-lg border border-border bg-muted px-2 text-xs text-muted-foreground">
                {detail}
              </div>
            </div>
          ))}
        </div>
      </div>
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
            className="h-9 w-full justify-between gap-2 rounded-2xl bg-card px-3.5 text-xs font-medium hover:bg-muted"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <BookOpen className="size-4 shrink-0 text-primary" />
              <span className="truncate">
                {selectedIds.length === 0
                  ? "General knowledge"
                  : `${selectedIds.length} source${selectedIds.length === 1 ? "" : "s"} selected`}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[320px] overflow-hidden rounded-2xl p-0 shadow-xl">
        <div className="flex items-center justify-between bg-muted px-3.5 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sources..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="ml-2 flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground"
          >
            Select all <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </button>
        </div>
        {sources.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
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
                    checked ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted",
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
        <div className="bg-muted p-2.5 text-xs text-muted-foreground">
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
            className="h-9 w-full justify-between gap-2 rounded-2xl bg-card px-3.5 text-xs font-medium hover:bg-muted"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <Cpu className="size-4 shrink-0 text-primary" />
              <span className="truncate">
                {selected?.displayName || selectedModel || "Select model"}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[280px] rounded-2xl p-2 shadow-xl">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Select model</div>
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
                  isSelected ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{model.displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">{model.id}</span>
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
