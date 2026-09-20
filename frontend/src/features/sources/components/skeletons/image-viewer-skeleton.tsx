import { Columns2, Eye, FileText, ImageIcon, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export function ImageViewerSkeleton() {
  const { t } = useTranslation("sources");
  return (
    <div
      data-testid="image-viewer-skeleton"
      className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Top Toolbar */}
      <div className="shrink-0 border-b border-border/60 bg-card/60 p-2 sm:p-3 flex items-center justify-between gap-2 shadow-xs">
        {/* View Mode Toggle Buttons */}
        <div className="flex items-center rounded-lg border border-border/70 p-0.5 bg-muted/40">
          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-background shadow-xs text-foreground font-medium">
            <Columns2 className="size-3.5" />
            <span>{t("skeletons.split")}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground/60">
            <Eye className="size-3.5" />
            <span>{t("skeletons.image")}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground/60">
            <FileText className="size-3.5" />
            <span>{t("skeletons.notes")}</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <div className="size-7 flex items-center justify-center rounded border border-border/50 text-muted-foreground/50">
            <ZoomOut className="size-3.5" />
          </div>
          <Skeleton className="h-4 w-10 rounded" />
          <div className="size-7 flex items-center justify-center rounded border border-border/50 text-muted-foreground/50">
            <ZoomIn className="size-3.5" />
          </div>
        </div>
      </div>

      {/* Main Image Viewport & Notes Area */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
        {/* Left: Image Viewport */}
        <div className="flex-1 bg-muted/20 flex items-center justify-center p-6 border-b sm:border-b-0 sm:border-r border-border/50 select-none">
          <div className="w-full max-w-lg aspect-4/3 rounded-xl border border-border/60 bg-card/60 flex flex-col items-center justify-center gap-3 p-6 shadow-xs">
            <div className="size-16 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground/40">
              <ImageIcon className="size-8" />
            </div>
            <Skeleton className="h-4 w-36 rounded-full" />
          </div>
        </div>

        {/* Right: Notes Sidebar */}
        <div className="w-full sm:w-72 md:w-80 shrink-0 p-4 space-y-4 overflow-y-auto bg-card/20">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>

          {[1, 2, 3].map((item, index) => (
            <div key={item} className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 rounded w-(--skeleton-width)" style={{ "--skeleton-width": `${80 - index * 15}%` } as React.CSSProperties} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
