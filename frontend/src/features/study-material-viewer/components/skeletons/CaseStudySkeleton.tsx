import { Skeleton } from "@/components/ui/skeleton";

export function CaseStudySkeleton() {
  return (
    <div
      data-slot="material-skeleton-case-study"
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-3 sm:gap-10 sm:py-6"
      aria-hidden="true"
    >
      <div className="space-y-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}
