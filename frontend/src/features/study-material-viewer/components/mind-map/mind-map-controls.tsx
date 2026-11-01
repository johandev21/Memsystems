import { ChevronsDownUp, ChevronsUpDown, Crosshair, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";

export function EmptyMindMap() {
  const { t } = useTranslation("viewer");
  return (
    <div className="flex min-h-105 items-center justify-center rounded-xl border border-surface-border-subtle bg-surface-2 text-sm text-text-tertiary">
      {t("mindMap.empty")}
    </div>
  );
}

export interface MindMapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  centerLabel?: string;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

function Control({ label, description, onClick, children }: {
  label: string;
  description: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className="size-8 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary cursor-pointer active:scale-95 touch-manipulation"
            aria-label={label}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="left">{description}</TooltipContent>
    </Tooltip>
  );
}

export function MindMapControls({
  onZoomIn,
  onZoomOut,
  onCenter,
  centerLabel,
  onExpandAll,
  onCollapseAll,
}: MindMapControlsProps) {
  const { t } = useTranslation("viewer");
  return (
    <TooltipProvider>
      <div className="absolute bottom-4 right-4 sm:bottom-auto sm:top-4 flex flex-row sm:flex-col gap-1.5 rounded-xl border border-surface-border bg-surface-2 p-1.5 shadow-sm">
        <Control label={t("mindMap.zoomIn")} description={t("mindMap.tooltips.zoomIn")} onClick={onZoomIn}>
          <Plus className="size-4" />
        </Control>
        <Control label={t("mindMap.zoomOut")} description={t("mindMap.tooltips.zoomOut")} onClick={onZoomOut}>
          <Minus className="size-4" />
        </Control>
        <Control label={centerLabel ?? t("mindMap.center")} description={centerLabel ?? t("mindMap.tooltips.center")} onClick={onCenter}>
          <Crosshair className="size-4" />
        </Control>
        {onExpandAll && (
          <Control label={t("mindMap.expandAll")} description={t("mindMap.tooltips.expandAll")} onClick={onExpandAll}>
            <ChevronsUpDown className="size-4" />
          </Control>
        )}
        {onCollapseAll && (
          <Control label={t("mindMap.collapseAll")} description={t("mindMap.tooltips.collapseAll")} onClick={onCollapseAll}>
            <ChevronsDownUp className="size-4" />
          </Control>
        )}
      </div>
    </TooltipProvider>
  );
}
