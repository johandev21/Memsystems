import { Skeleton } from "@/components/ui/skeleton";

export function LibraryHeroSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <Skeleton className="h-9 w-36 rounded-xl" />
    </section>
  );
}

export function LibraryGridSkeleton() {
  return (
    <div className="library-grid py-2" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-42 w-59.75 rounded-artwork" />
      ))}
    </div>
  );
}
