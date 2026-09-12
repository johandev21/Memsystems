import { Crosshair, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function EmptyMindMap() {
  const { t } = useTranslation("viewer");
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-surface-border-subtle bg-surface-2 text-sm text-text-tertiary">
      {t("mindMap.empty")}
    </div>
  );
}

export interface MindMapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
}

export function MindMapControls({ onZoomIn, onZoomOut, onCenter }: MindMapControlsProps) {
  const { t } = useTranslation("viewer");
  return (
    <div className="absolute bottom-4 right-4 sm:bottom-auto sm:top-4 flex flex-row sm:flex-col gap-1.5 rounded-xl border border-surface-border bg-surface-2 p-1.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomIn}
        className="size-8 border border-surface-border-strong text-text-secondary transition-colors hover:bg-surface-3"
        aria-label={t("mindMap.zoomIn")}
      >
        <Plus className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomOut}
        className="size-8 border border-surface-border-strong text-text-secondary transition-colors hover:bg-surface-3"
        aria-label={t("mindMap.zoomOut")}
      >
        <Minus className="size-4" />
      </Button>
      <div className="mx-1 h-px bg-surface-border hidden sm:block" />
      <div className="mx-1 w-px bg-surface-border sm:hidden" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onCenter}
        className="size-8 border border-surface-border-strong text-text-secondary transition-colors hover:bg-surface-3"
        aria-label={t("mindMap.center")}
      >
        <Crosshair className="size-4" />
      </Button>
    </div>
  );
}
