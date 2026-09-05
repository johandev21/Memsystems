import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { type Source, sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";

export interface SourceMultiSelectProps {
  notebookId: string;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function SourceMultiSelect({
  notebookId,
  value,
  onChange,
  className,
}: SourceMultiSelectProps) {
  const { data: sources = [] } = useQuery(sourcesQueryOptions(notebookId));
  const valueSet = useMemo(() => new Set(value), [value]);

  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      if (value.includes(id)) return;
      onChange([...value, id]);
    } else {
      onChange(value.filter((v) => v !== id));
    }
  };

  if (sources.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border/60 bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        No sources yet. Add a source first to generate a study material.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card max-h-[200px] overflow-y-auto overflow-x-hidden p-1",
        className,
      )}
    >
      {sources.map((source) => (
        <SourceRow
          key={source.id}
          source={source}
          checked={valueSet.has(source.id)}
          onToggle={(checked) => toggle(source.id, checked)}
        />
      ))}
    </div>
  );
}

function SourceRow({
  source,
  checked,
  onToggle,
}: {
  source: Source;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const id = `source-${source.id}`;
  return (
    <Label
      htmlFor={id}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-muted/60 cursor-pointer text-sm"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onToggle(c === true)}
        className="shrink-0"
      />
      <span className="min-w-0 flex-1 truncate">{source.title}</span>
      <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground/70">
        {source.kind}
      </span>
    </Label>
  );
}
