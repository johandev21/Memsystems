import { Skeleton } from "@/components/ui/skeleton";

export function FlashcardSkeleton() {
  return (
    <div
      data-slot="flashcard-skeleton"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex min-h-64 flex-col items-center justify-center gap-6 rounded-2xl bg-surface-2 p-6 sm:min-h-72 sm:p-8">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  );
}
