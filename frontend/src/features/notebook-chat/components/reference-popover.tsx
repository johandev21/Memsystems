import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import type { CitedSourceDTO } from "@/shared/api";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { getReferenceExcerpt, getSafeReferenceUrl } from "../model/message-reference";

interface ReferencePopoverProps {
  reference: CitedSourceDTO;
  children?: ReactNode;
  compact?: boolean;
}

export function ReferencePopover({ reference, children, compact = false }: ReferencePopoverProps) {
  const safeUrl = getSafeReferenceUrl(reference.url);
  const kindLabel = reference.kind === "unknown" ? "Source" : capitalize(reference.kind);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Reference ${reference.number}: ${reference.title}`}
            className={cn(
              compact
                ? "inline-flex min-h-7 max-w-full items-center rounded-xl px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                : "inline rounded-lg px-0.5 font-medium text-muted-foreground underline decoration-1 underline-offset-[3px] outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
            )}
          />
        }
      >
        {children ?? reference.title}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))]"
      >
        <PopoverHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{kindLabel}</Badge>
            {!reference.isAvailable && <Badge variant="outline">Source unavailable</Badge>}
          </div>
          <PopoverTitle>{reference.title}</PopoverTitle>
          <PopoverDescription className="max-h-48 overflow-y-auto leading-relaxed">
            {getReferenceExcerpt(reference)}
          </PopoverDescription>
        </PopoverHeader>

        {safeUrl && reference.isAvailable && (
          <Button
            render={<a href={safeUrl} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
            size="sm"
            variant="ghost"
          >
            Open source
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface MessageReferencesProps {
  references: CitedSourceDTO[];
}

export function MessageReferences({ references }: MessageReferencesProps) {
  if (references.length === 0) return null;

  return (
    <div
      aria-label="References"
      className="not-typeset mt-2 flex flex-wrap items-center gap-1"
      data-not-typeset
    >
      {references.map((reference) => (
        <ReferencePopover
          key={`${reference.citationKey}-${reference.id}-${reference.chunkId ?? "source"}`}
          reference={reference}
          compact
        />
      ))}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
