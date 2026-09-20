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
            <Skeleton className="h-4 w-24/25 rounded" />
            <Skeleton className="h-4 w-23/25 rounded" />
            <Skeleton className="h-4 w-3/5 rounded" />
          </div>
        </div>

        {/* Callout / Blockquote card simulation */}
        <div className="border-l-2 border-primary/30 pl-4 py-3 space-y-2 bg-muted/20 rounded-r-lg">
          <Skeleton className="h-4 w-19/20 rounded" />
          <Skeleton className="h-4 w-17/20 rounded" />
          <Skeleton className="h-4 w-13/20 rounded" />
        </div>

        {/* Second Section Heading (H2) */}
        <div className="space-y-3 pt-2">
          <Skeleton className="h-6 w-2/5 max-w-sm rounded-md" />

          {/* Second Paragraph */}
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-47/50 rounded" />
            <Skeleton className="h-4 w-9/10 rounded" />
            <Skeleton className="h-4 w-9/20 rounded" />
          </div>
        </div>

        {/* Bullet list simulation */}
        <div className="space-y-2.5 pt-2 pl-2">
          {[1, 2, 3].map((item, index) => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <Skeleton className="h-4 rounded w-(--skeleton-width)" style={{ "--skeleton-width": `${75 - index * 12}%` } as React.CSSProperties} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
