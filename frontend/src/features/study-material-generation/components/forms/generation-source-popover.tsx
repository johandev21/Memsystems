import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, FileText, Globe, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  generationSourceCheckboxClass,
  generationSourceIconClass,
  generationSourceOptionClass,
} from "./option-row";

export type GenerationSource = { id: string; title: string; kind: string };

interface GenerationSourcePopoverProps {
  sources: GenerationSource[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyMessage: string;
}

export function GenerationSourcePopover({
  sources,
  selectedIds,
  onChange,
  emptyMessage,
}: GenerationSourcePopoverProps) {
  const [search, setSearch] = useState("");
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredSources = sources.filter((source) =>
    source.title.toLowerCase().includes(search.toLowerCase()),
  );
  const allFilteredSourcesSelected =
    filteredSources.length > 0 &&
    filteredSources.every((source) => selectedIdSet.has(source.id));

  const toggleAllSources = () => {
    if (allFilteredSourcesSelected) {
      const filteredIds = new Set(filteredSources.map((source) => source.id));
      onChange(selectedIds.filter((id) => !filteredIds.has(id)));
      return;
    }
    onChange(Array.from(new Set([...selectedIds, ...filteredSources.map((source) => source.id)])));
  };

  const toggleSource = (id: string) => {
    onChange(
      selectedIdSet.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 rounded-2xl border border-surface-border-subtle bg-surface-2 px-3.5 text-xs font-medium text-text-tertiary hover:bg-surface-3 hover:text-text-secondary"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <BookOpen className="size-4 shrink-0 text-primary" />
              <span className="truncate">
                {selectedIds.length === 0
                  ? "None selected (General Knowledge)"
                  : `${selectedIds.length} source${selectedIds.length === 1 ? "" : "s"} selected`}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-text-faint" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-[320px] overflow-hidden rounded-2xl border border-surface-border bg-surface-1 p-0 shadow-xl"
      >
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
            onClick={toggleAllSources}
            className="ml-2 flex shrink-0 cursor-pointer items-center gap-2 text-xs text-text-tertiary"
          >
            Select all{" "}
            <Checkbox checked={allFilteredSourcesSelected} onCheckedChange={toggleAllSources} />
          </button>
        </div>
        {sources.length === 0 ? (
          <div className="p-4 text-center text-xs text-text-faint">{emptyMessage}</div>
        ) : (
          <div className="max-h-[220px] space-y-1 overflow-y-auto p-2">
            {filteredSources.map((source) => {
              const checked = selectedIdSet.has(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => toggleSource(source.id)}
                  className={generationSourceOptionClass(checked)}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate pr-2">
                    {source.kind === "web" ? (
                      <Globe className={generationSourceIconClass(checked)} />
                    ) : source.kind === "file" ? (
                      <FileText className={generationSourceIconClass(checked)} />
                    ) : (
                      <BookOpen className={generationSourceIconClass(checked)} />
                    )}
                    <span className="truncate">{source.title}</span>
                  </span>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSource(source.id)}
                    className={generationSourceCheckboxClass(checked)}
                  />
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
