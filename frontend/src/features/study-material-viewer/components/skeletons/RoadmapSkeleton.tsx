import { Skeleton } from "@/components/ui/skeleton";

export function RoadmapSkeleton() {
  return (
    <div
      data-slot="roadmap-skeleton"
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      {/* Spine + phase cards */}
      <div className="relative flex flex-col gap-6 pt-2">
        <div className="absolute top-0 bottom-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-muted" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`relative flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
          >
            <Skeleton className="h-32 w-[45%] rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
