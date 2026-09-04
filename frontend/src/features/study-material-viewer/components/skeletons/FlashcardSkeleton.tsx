import { Skeleton } from "@/components/ui/skeleton";

export function FlashcardSkeleton() {
  return (
    <div
      data-slot="flashcard-skeleton"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      aria-hidden="true"
    >
      {/* Progress + counter */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      {/* Card stage */}
      <Skeleton className="h-64 w-full rounded-2xl sm:h-72" />
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      {/* Nav / rating buttons */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  );
}
