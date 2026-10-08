import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/shared/utils/cn";

export function LibraryHeroSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="hidden sm:flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between w-full"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <Skeleton className="h-9 w-36 rounded-xl" />
    </section>
  );
}

export function MobileLibrarySkeleton() {
  return (
    <div className="flex flex-col gap-3 pb-24 w-full sm:hidden" aria-hidden="true">
      {/* Mobile Header: Title + Sort control */}
      <div className="flex items-center justify-between gap-2 w-full py-1.5">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-22 rounded-full" />
      </div>

      {/* Tactile item tiles */}
      <div className="flex flex-col gap-2 w-full">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex w-full items-center justify-between rounded-2xl border border-border/20 bg-card p-3 shadow-2xs"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton
                  className={cn(
                    "h-4 rounded-md",
                    index % 3 === 0 ? "w-36" : index % 3 === 1 ? "w-44" : "w-28",
                  )}
                />
                <Skeleton className="h-3 w-14 rounded-md" />
              </div>
            </div>
            <Skeleton className="size-8 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Floating Action Button placeholder */}
      <Skeleton className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 z-30 size-14 rounded-full shadow-lg" />
    </div>
  );
}

export function LibraryGridSkeleton() {
  return (
    <>
      <MobileLibrarySkeleton />
      <div className="hidden sm:grid library-grid py-2" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-42 w-59.75 rounded-artwork" />
        ))}
      </div>
    </>
  );
}
