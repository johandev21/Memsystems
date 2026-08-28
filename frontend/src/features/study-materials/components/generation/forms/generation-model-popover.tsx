import { Cpu, ChevronDown } from "lucide-react";
import type { ModelOption } from "@/shared/api/models";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";

interface GenerationModelPopoverProps {
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export function GenerationModelPopover({
  models,
  selectedModel,
  onModelChange,
  disabled,
}: GenerationModelPopoverProps) {
  const selected = models.find((model) => model.id === selectedModel) ?? models[0];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-9 w-full justify-between gap-2 rounded-2xl border border-surface-border-subtle bg-surface-2 px-3.5 text-xs font-medium text-text-tertiary hover:bg-surface-3 hover:text-text-secondary"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <Cpu className="size-4 shrink-0 text-primary" />
              <span className="truncate">
                {selected?.displayName || selectedModel || "Select Model"}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-text-faint" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="w-[280px] rounded-2xl border border-surface-border bg-surface-1 p-2 shadow-xl"
      >
        <div className="px-2 py-1 text-xs font-medium text-text-faint">Select Model</div>
        <div className="mt-1 space-y-1">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => onModelChange(model.id)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-xl p-2.5 text-left text-xs",
                model.id === selectedModel
                  ? "bg-surface-3 font-semibold text-text-secondary"
                  : "text-text-tertiary hover:bg-surface-2",
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{model.displayName}</span>
                <span className="text-xs font-normal text-text-faint">{model.id}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
