import { Columns2, FileText, ImageIcon } from "lucide-react";
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
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-muted/20 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <ImageIcon className="size-3 text-primary" />
          Image Document
        </Badge>
        {segmentsWithRegionsCount > 0 && (
          <Badge variant="secondary" className="font-normal text-[11px]">
            {segmentsWithRegionsCount} visual {segmentsWithRegionsCount === 1 ? "region" : "regions"}
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
            title="Split View"
          >
            <Columns2 className="size-3 mr-1" />
            Split
          </Button>
          <Button
            type="button"
            variant={viewMode === "image" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("image")}
            className="h-6 px-2 text-xs font-medium cursor-pointer"
            title="Image Only"
          >
            <ImageIcon className="size-3 mr-1" />
            Image
          </Button>
          <Button
            type="button"
            variant={viewMode === "notes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("notes")}
            className="h-6 px-2 text-xs font-medium cursor-pointer"
            title="Notes Only"
          >
            <FileText className="size-3 mr-1" />
            Notes
          </Button>
        </div>
      </div>
    </div>
  );
}
