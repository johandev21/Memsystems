import { ChevronsDownUp, ChevronsUpDown, Crosshair, Minus, Plus } from "lucide-react";
import { useId } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function MindMapSkeleton() {
  const dotsId = useId();
  return (
    <div
      data-slot="mind-map-skeleton"
      className="relative h-[min(520px,calc(100dvh-160px))] min-h-105 w-full overflow-hidden sm:h-[min(680px,calc(100dvh-180px))]"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 size-full text-surface-border opacity-60">
        <defs>
          <pattern id={dotsId} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${dotsId})`} />
      </svg>
      <svg className="absolute inset-0 size-full text-surface-border-strong" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        <path d="M 33 50 C 47 50, 46 20, 60 20 M 33 50 C 47 50, 46 40, 60 40 M 33 50 C 47 50, 46 60, 60 60 M 33 50 C 47 50, 46 80, 60 80" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute top-1/2 left-[8%] flex h-12 w-1/4 -translate-y-1/2 items-center rounded-xl border border-surface-border-strong bg-surface-3 px-3 sm:px-4">
        <Skeleton className="h-3 w-4/5 rounded-full" />
      </div>
      {["top-[20%]", "top-[40%]", "top-[60%]", "top-[80%]"].map((top) => (
        <div key={top} className={`absolute left-[60%] flex h-12 w-1/4 -translate-y-1/2 items-center rounded-lg border border-surface-border-subtle bg-surface-2 px-3 sm:px-4 ${top}`}>
          <Skeleton className="h-3 w-3/4 rounded-full" />
        </div>
      ))}
      <div className="absolute right-4 bottom-4 flex flex-row gap-1.5 rounded-xl border border-surface-border bg-surface-2 p-1.5 text-text-secondary sm:top-4 sm:bottom-auto sm:flex-col">
        {[Plus, Minus, Crosshair, ChevronsUpDown, ChevronsDownUp].map((Icon, index) => (
          <div key={index} className="flex size-8 items-center justify-center opacity-50"><Icon className="size-4" /></div>
        ))}
      </div>
    </div>
  );
}
