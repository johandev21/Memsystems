import { Search } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ModelOption } from "@/features/ai";
import { cn } from "@/shared/utils/cn";

export interface ModelSelectorProps {
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ModelSelector({ models, selectedModel, onModelChange }: ModelSelectorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeModelDetails = useMemo(
    () => models.find((m) => m.id === selectedModel),
    [models, selectedModel],
  );

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return models;
    return models.filter(
      (m) => m.displayName.toLowerCase().includes(query) || m.id.toLowerCase().includes(query),
    );
  }, [models, search]);

  const handleSelectModel = (modelId: string) => {
    onModelChange(modelId);
    setPopoverOpen(false);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3 gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center shadow-none cursor-pointer transition-colors hover:bg-muted/60"
          />
        }
      >
        <span className="max-w-[120px] truncate">
          {activeModelDetails?.displayName || selectedModel}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[300px] overflow-hidden rounded-2xl border border-border bg-popover p-3 text-foreground shadow-2xl"
      >
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 hover:bg-muted/80 focus:bg-muted border border-border/80 focus:border-primary/50 outline-hidden placeholder:text-muted-foreground/60 transition-colors rounded-xl"
          />
        </div>

        <ScrollArea className="h-[200px]">
          <div className="space-y-0.5 pr-2">
            {filteredModels.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-8">No models found</div>
            ) : (
              filteredModels.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  selectedModel={selectedModel}
                  onSelectModel={handleSelectModel}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface ModelRowProps {
  model: ModelOption;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

function ModelRow({ model, selectedModel, onSelectModel }: ModelRowProps) {
  const isSelected = model.id === selectedModel;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectModel(model.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectModel(model.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/row flex cursor-pointer items-center rounded-xl p-2 transition-colors",
        isSelected
          ? "bg-popover-selected text-foreground"
          : "text-muted-foreground hover:bg-popover-hover hover:text-foreground",
      )}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-foreground leading-tight truncate">
          {model.displayName}
        </span>
        <span className="text-xs text-muted-foreground/70 leading-none mt-1 truncate">
          {model.id}
        </span>
      </div>
    </div>
  );
}

export interface DialogModelSelectorProps {
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export function DialogModelSelector({
  models,
  selectedModel,
  onModelChange,
  disabled = false,
}: DialogModelSelectorProps) {
  const activeModelDetails = models.find((m) => m.id === selectedModel);

  return (
    <Select
      value={selectedModel}
      onValueChange={(val) => {
        if (val) onModelChange(val);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-full h-9 px-3 text-xs bg-muted/50 hover:bg-muted/80 focus:bg-muted border border-border/80 focus:border-primary/50 transition-colors rounded-2xl">
        <SelectValue placeholder="Select model...">
          {activeModelDetails?.displayName || selectedModel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[300px]">
        {models.map((model) => (
          <SelectItem
            key={model.id}
            value={model.id}
            label={model.displayName}
            className="text-xs py-2 cursor-pointer"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-foreground leading-tight truncate">
                {model.displayName}
              </span>
              <span className="text-xs text-muted-foreground/70 leading-none mt-1 truncate">
                {model.id}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
