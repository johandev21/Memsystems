import { Presentation } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function SlidesViewerSkeleton() {
  return (
    <div
      data-testid="slides-viewer-skeleton"
      className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Top Slide Navigator Toolbar */}
      <div className="shrink-0 border-b border-border/50 bg-card/50 p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Slide pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Presentation className="size-3" />
              <span>Slide 1</span>
            </div>
            {[2, 3, 4].map((num) => (
              <div
                key={num}
                className="h-7 px-2.5 rounded-md border border-border/60 bg-card text-xs flex items-center text-muted-foreground/60"
              >
                Slide {num}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28 sm:w-36 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>

      {/* Main Slide Card Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        <div className="max-w-3xl mx-auto rounded-xl border border-border/60 bg-card/40 p-4 sm:p-6 space-y-4 shadow-xs">
          {/* Slide Card Header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>

          {/* Slide Title */}
          <Skeleton className="h-7 w-3/5 rounded-md" />

          {/* Slide Content Blocks */}
          <div className="space-y-3 pt-2">
            <div className="rounded-lg border border-border/40 bg-background/80 p-4 space-y-2">
              <Skeleton className="h-5 w-1/2 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-4/5 rounded" />
            </div>

            <div className="rounded-lg border border-border/40 bg-background/80 p-4 space-y-2">
              <Skeleton className="h-5 w-2/5 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
