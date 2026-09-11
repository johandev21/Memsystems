import { Headphones, RotateCcw, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export function AudioViewerSkeleton() {
  const { t } = useTranslation("sources");
  return (
    <div
      data-testid="audio-viewer-skeleton"
      className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Top Audio Player Header & Controls Bar */}
      <div className="shrink-0 border-b border-border/70 bg-card/60 p-3 sm:p-4 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          {/* Top Row: Title badge & statistics placeholders */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border/60 text-[11px] text-muted-foreground">
                <Headphones className="size-3 text-muted-foreground/60" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24 rounded" />
          </div>

          {/* Middle Row: Scrubber Timeline */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="w-full h-1.5 rounded-lg" />
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
              <span>{t("skeletons.audioStartTime")}</span>
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          </div>

          {/* Bottom Row: Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Playback action buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="size-8 flex items-center justify-center text-muted-foreground/50">
                <RotateCcw className="size-4" />
              </div>
              <Skeleton className="size-9 rounded-full" />
              <div className="size-8 flex items-center justify-center text-muted-foreground/50">
                <RotateCw className="size-4" />
              </div>
            </div>

            {/* Right side controls: Speed & Volume */}
            <div className="flex items-center gap-2 sm:gap-4">
              <Skeleton className="h-8 w-14 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Transcript Body: Speaker Segments */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Search bar skeleton */}
          <Skeleton className="h-9 w-full max-w-sm rounded-lg" />

          {/* Transcript segment cards */}
          {[1, 2, 3, 4].map((item, index) => (
            <div key={item} className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 rounded" style={{ width: `${85 - (index % 3) * 12}%` }} />
                {index % 2 === 0 && (
                  <Skeleton
                    className="h-4 rounded"
                    style={{ width: `${65 + (index % 2) * 15}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
