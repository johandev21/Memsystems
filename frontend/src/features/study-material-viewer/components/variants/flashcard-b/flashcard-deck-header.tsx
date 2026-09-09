import { BookOpen, Columns, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FlashcardDeckHeaderProps {
  deckTitle: string;
  sourceCount: number;
  showSideBySide: boolean;
  onToggleLayout: () => void;
}

export function FlashcardDeckHeader({
  deckTitle,
  sourceCount,
  showSideBySide,
  onToggleLayout,
}: FlashcardDeckHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-surface-border-subtle bg-surface-2">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-text-primary truncate">{deckTitle}</h2>
        <Badge variant="outline" className="rounded-full text-xs px-2.5 py-0.5 font-normal gap-1">
          <BookOpen className="size-3 text-text-tertiary" /> {sourceCount} sources
        </Badge>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onToggleLayout}
        className="h-8 px-3 text-xs font-medium gap-1.5 rounded-2xl cursor-pointer"
      >
        {showSideBySide ? <Eye className="size-3.5" /> : <Columns className="size-3.5" />}
        {showSideBySide ? "Single Focus" : "Side-by-Side"}
      </Button>
    </div>
  );
}
