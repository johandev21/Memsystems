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
    <div className="flex flex-col gap-4 px-2 pb-24 w-full sm:hidden" aria-hidden="true">
      <div className="flex items-center w-full pt-5">
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>

      <div className="flex flex-col gap-3.5 w-full">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex w-full items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className="size-5 shrink-0 rounded-sm" />
              <Skeleton
                className={cn(
                  "h-4 rounded-md",
                  index % 3 === 0 ? "w-36" : index % 3 === 1 ? "w-44" : "w-28",
                )}
              />
            </div>
            <Skeleton className="size-5 shrink-0 rounded-md" />
          </div>
        ))}
      </div>

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
