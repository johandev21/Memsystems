import { Skeleton } from "@/components/ui/skeleton";

export function SlidesSkeleton() {
  return (
    <div
      data-slot="slides-skeleton"
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 sm:px-4"
      aria-hidden="true"
    >
      {/* Counter + export row */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>
      {/* Stage */}
      <Skeleton className="aspect-video w-full rounded-2xl" />
      {/* Thumbnails */}
      <div className="flex gap-2 overflow-hidden pb-1">
        <Skeleton className="h-18 w-28 shrink-0 rounded-xl" />
        <Skeleton className="h-18 w-28 shrink-0 rounded-xl" />
        <Skeleton className="h-18 w-28 shrink-0 rounded-xl" />
        <Skeleton className="hidden h-18 w-28 shrink-0 rounded-xl sm:block" />
        <Skeleton className="hidden h-18 w-28 shrink-0 rounded-xl md:block" />
      </div>
      {/* CTA */}
      <div className="flex justify-center">
        <Skeleton className="h-8 w-44 rounded-xl" />
      </div>
    </div>
  );
}
