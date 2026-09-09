import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IndexedCard } from "./types";

export interface ExplainPromptPanelProps {
  activeCard: IndexedCard;
  onClose: () => void;
}

export function ExplainPromptPanel({ activeCard, onClose }: ExplainPromptPanelProps) {
  return (
    <div className="p-4 bg-surface-2 border-t border-surface-border-subtle space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-text-primary">
        <span className="flex items-center gap-1">
          <MessageSquare className="size-3.5 text-text-tertiary" /> Static Explain Prompt
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-5 px-1.5 text-xs"
        >
          <X className="size-3" />
        </Button>
      </div>
      <p className="text-xs text-text-faint">
        &quot;On the front: &apos;{activeCard.front}&apos;. On the back: &apos;{activeCard.back}
        &apos;. Explain this topic in more detail.&quot;
      </p>
    </div>
  );
}
