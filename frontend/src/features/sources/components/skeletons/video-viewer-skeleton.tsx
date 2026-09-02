import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function VideoViewerSkeleton() {
  return (
    <div
      data-testid="video-viewer-skeleton"
      className="@container flex h-full w-full flex-col @min-[720px]:flex-row overflow-hidden bg-surface-0 text-text-primary"
    >
      {/* Video Viewport Container */}
      <div className="flex flex-col @min-[720px]:w-1/2 @min-[900px]:w-3/5 shrink-0 border-b @min-[720px]:border-b-0 @min-[720px]:border-r border-surface-border bg-black items-center justify-center">
        <div className="relative w-full aspect-video max-h-[45vh] @min-[720px]:max-h-full bg-black/90 flex items-center justify-center overflow-hidden shrink-0 select-none">
          <div className="size-12 rounded-full border border-white/20 bg-white/10 flex items-center justify-center backdrop-blur-xs">
            <Play className="size-5 text-white/50 ml-0.5" />
          </div>
        </div>
      </div>

      {/* Video Transcript Pane */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 bg-surface-0 overflow-hidden">
        <div className="shrink-0 border-b border-surface-border bg-surface-0 px-3 py-2 @min-[720px]:px-4 @min-[720px]:py-2.5">
          <Skeleton className="h-8 w-full max-w-sm rounded-md" />
        </div>

        <div className="flex-1 overflow-y-auto p-3 @min-[720px]:p-4 space-y-2.5">
          {[1, 2, 3].map((item, index) => (
            <div
              key={item}
              className="rounded-lg border border-surface-border-subtle bg-surface-1 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 rounded" style={{ width: `${80 - index * 10}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
