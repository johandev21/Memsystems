import { Search, X } from "lucide-react";

export interface PptxSearchBarProps {
  searchQuery: string;
  onChange: (v: string) => void;
}

export function PptxSearchBar({ searchQuery, onChange }: PptxSearchBarProps) {
  return (
    <div className="shrink-0 border-b border-border/40 bg-muted/10 px-4 py-2">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          type="text"
          data-testid="pptx-search-input"
          value={searchQuery}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search slides…"
          aria-label="Search slides"
          className="h-8 w-full rounded-lg border border-border/60 bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Clear search"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}
