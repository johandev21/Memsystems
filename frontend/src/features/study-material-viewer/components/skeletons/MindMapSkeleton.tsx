import { Skeleton } from "@/components/ui/skeleton";

export function MindMapSkeleton() {
  return (
    <div
      data-slot="mind-map-skeleton"
      className="relative mx-auto h-[400px] w-full max-w-4xl overflow-hidden rounded-2xl border border-surface-border-subtle bg-card/50"
      aria-hidden="true"
    >
      {/* Central node */}
      <Skeleton className="absolute top-1/2 left-1/2 h-14 w-44 -translate-x-1/2 -translate-y-1/2 rounded-2xl" />
      {/* Satellite nodes (CSS only, no ReactFlow) */}
      <Skeleton className="absolute top-[12%] left-[12%] h-10 w-32 rounded-full" />
      <Skeleton className="absolute top-[18%] right-[10%] h-10 w-36 rounded-full" />
      <Skeleton className="absolute bottom-[20%] left-[8%] h-10 w-28 rounded-full" />
      <Skeleton className="absolute right-[12%] bottom-[14%] h-10 w-32 rounded-full" />
      <Skeleton className="absolute top-[48%] left-[4%] hidden h-8 w-24 rounded-full sm:block" />
      <Skeleton className="absolute top-[48%] right-[4%] hidden h-8 w-24 rounded-full sm:block" />
      {/* Toolbar */}
      <div className="absolute right-3 bottom-3 flex gap-1.5">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}
