import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils/cn";
import type { IndexedCard } from "./types";

export interface FlashcardSidebarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  filteredCards: IndexedCard[];
  currentIndex: number;
  onSelectIndex: (idx: number) => void;
}

export function FlashcardSidebar({
  searchQuery,
  onSearchChange,
  filteredCards,
  currentIndex,
  onSelectIndex,
}: FlashcardSidebarProps) {
  return (
    <div className="w-56 md:w-64 flex flex-col shrink-0 bg-surface-1">
      <div className="p-3 border-b border-surface-border-subtle">
        <div className="relative">
          <Search className="size-3.5 absolute left-3 top-3 text-text-faint" />
          <Input
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs rounded-2xl bg-surface-2 border-surface-border-strong focus-visible:ring-surface-border-strong"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredCards.map((c) => {
          const isSelected = c.originalIndex === currentIndex;
          return (
            <button
              key={c.originalIndex}
              type="button"
              onClick={() => onSelectIndex(c.originalIndex)}
              className={cn(
                "w-full text-left p-3 rounded-2xl border text-xs transition-all cursor-pointer space-y-1",
                isSelected
                  ? "bg-surface-3 border-surface-border font-semibold shadow-2xs text-text-secondary"
                  : "bg-surface-2 border-surface-border-subtle hover:bg-surface-3 text-text-tertiary hover:text-text-secondary",
              )}
            >
              <span className="text-xs text-text-faint block">#{c.originalIndex + 1}</span>
              <p className="line-clamp-2 leading-relaxed">{c.front}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
