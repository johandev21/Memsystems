import { Button } from "@/components/ui/button";
import type { Source } from "@/features/sources";

export interface SourceRefsProps {
  ids: string[];
  sources: Source[];
  sourcesLoaded: boolean;
  openSource: (id: string) => void;
}

export function SourceRefs({ ids, sources, sourcesLoaded, openSource }: SourceRefsProps) {
  if (ids.length === 0) return null;
  return (
    <ul className="space-y-1">
      {ids.map((id) => {
        const source = sources.find((candidate) => candidate.id === id);
        return (
          <li key={id} className="text-sm">
            {source ? (
              <Button
                variant="link"
                className="h-auto max-w-full whitespace-normal p-0 text-left"
                onClick={() => openSource(id)}
              >
                {source.title}
              </Button>
            ) : (
              <span className="text-text-tertiary">
                {sourcesLoaded ? "Source unavailable" : "Source reference unavailable until loaded"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
