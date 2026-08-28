import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/shared/utils/cn";

export function StudyMaterialsTreeSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="study-materials-tree-skeleton"
      className={cn("flex flex-col gap-2 p-2", className)}
      aria-label="Loading study materials"
      aria-busy="true"
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-2 py-1">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-1">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>
      {/* Tree rows skeleton - tree shaped */}
      <div className="flex flex-col gap-1.5 px-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <div className="flex items-center gap-2 pl-4">
          <Skeleton className="h-3 w-3 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex items-center gap-2 pl-8">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        <div className="flex items-center gap-2 pl-8">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="flex items-center gap-2 pl-4">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-3.5 w-44" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-sm" />
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="flex items-center gap-2 pl-4">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
    </div>
  );
}
