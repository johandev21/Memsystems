import { Skeleton } from "@/components/ui/skeleton";

export function PracticeProblemsSkeleton() {
  return (
    <div
      data-slot="material-skeleton-practice-problems"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      aria-hidden="true"
    >
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl border border-surface-border p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
      ))}
    </div>
  );
}
