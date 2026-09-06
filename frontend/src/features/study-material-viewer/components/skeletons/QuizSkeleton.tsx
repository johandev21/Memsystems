import { Skeleton } from "@/components/ui/skeleton";

export function QuizSkeleton() {
  return (
    <div
      data-slot="quiz-skeleton"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-3 sm:py-6"
      aria-hidden="true"
    >
      {/* Progress and question position */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      {/* Question stem */}
      <div className="flex flex-col gap-2 pt-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {/* Options */}
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      {/* Footer nav */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  );
}
