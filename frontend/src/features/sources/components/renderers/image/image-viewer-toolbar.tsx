import { Columns2, FileText, ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "./image-types";

export interface ImageViewerToolbarProps {
  segmentsWithRegionsCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ImageViewerToolbar({
  segmentsWithRegionsCount,
  viewMode,
  onViewModeChange,
}: ImageViewerToolbarProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-muted/20 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <ImageIcon className="size-3 text-primary" />
          {t("imageToolbar.imageDocument")}
        </Badge>
        {segmentsWithRegionsCount > 0 && (
          <Badge variant="secondary" className="font-normal text-[11px]">
            {t("imageToolbar.visualRegions", { count: segmentsWithRegionsCount })}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5">
          <Button
            type="button"
            variant={viewMode === "split" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("split")}
            className="h-6 px-2 text-xs font-medium cursor-pointer"
            title={t("imageToolbar.splitViewTitle")}
          >
            <Columns2 className="size-3 mr-1" />
            {t("imageToolbar.split")}
          </Button>
          <Button
            type="button"
            variant={viewMode === "image" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("image")}
            className="h-6 px-2 text-xs font-medium cursor-pointer"
            title={t("imageToolbar.imageOnlyTitle")}
          >
            <ImageIcon className="size-3 mr-1" />
            {t("imageToolbar.image")}
          </Button>
          <Button
            type="button"
            variant={viewMode === "notes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("notes")}
            className="h-6 px-2 text-xs font-medium cursor-pointer"
            title={t("imageToolbar.notesOnlyTitle")}
          >
            <FileText className="size-3 mr-1" />
            {t("imageToolbar.notes")}
          </Button>
        </div>
      </div>
    </div>
  );
}
