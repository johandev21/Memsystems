import { Skeleton } from "@/components/ui/skeleton";

interface DocumentViewerSkeletonProps {
  variant?: "document" | "book" | "article";
}

export function DocumentViewerSkeleton({ variant = "document" }: DocumentViewerSkeletonProps) {
  return (
    <div
      data-testid="document-viewer-skeleton"
      className="h-full w-full overflow-y-auto overscroll-contain bg-background text-foreground"
    >
      <div className="w-full flex flex-col p-4 sm:p-6 max-w-4xl mx-auto gap-5">
        {/* Top metadata chip */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          {variant === "book" && <Skeleton className="h-5 w-16 rounded-full" />}
          <Skeleton className="h-4 w-20 rounded" />
        </div>

        {/* Document Title (H1) */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4 max-w-xl rounded-md" />
          <Skeleton className="h-4 w-1/3 max-w-xs rounded" />
        </div>

        <div className="border-b border-border/40" />

        {/* Section Heading (H2) */}
        <div className="space-y-3 pt-2">
          <Skeleton className="h-6 w-1/2 max-w-md rounded-md" />

          {/* First Paragraph */}
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[96%] rounded" />
            <Skeleton className="h-4 w-[92%] rounded" />
            <Skeleton className="h-4 w-[60%] rounded" />
          </div>
        </div>

        {/* Callout / Blockquote card simulation */}
        <div className="border-l-2 border-primary/30 pl-4 py-3 space-y-2 bg-muted/20 rounded-r-lg">
          <Skeleton className="h-4 w-[95%] rounded" />
          <Skeleton className="h-4 w-[85%] rounded" />
          <Skeleton className="h-4 w-[65%] rounded" />
        </div>

        {/* Second Section Heading (H2) */}
        <div className="space-y-3 pt-2">
          <Skeleton className="h-6 w-2/5 max-w-sm rounded-md" />

          {/* Second Paragraph */}
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-[94%] rounded" />
            <Skeleton className="h-4 w-[90%] rounded" />
            <Skeleton className="h-4 w-[45%] rounded" />
          </div>
        </div>

        {/* Bullet list simulation */}
        <div className="space-y-2.5 pt-2 pl-2">
          {[1, 2, 3].map((item, index) => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <Skeleton className="h-4 rounded" style={{ width: `${75 - index * 12}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
