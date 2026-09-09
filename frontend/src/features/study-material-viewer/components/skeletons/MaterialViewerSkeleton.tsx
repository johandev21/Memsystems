import { Skeleton } from "@/components/ui/skeleton";
import type { StudyMaterialKind } from "../../types";
import { CaseStudySkeleton } from "./CaseStudySkeleton";
import { FlashcardSkeleton } from "./FlashcardSkeleton";
import { MindMapSkeleton } from "./MindMapSkeleton";
import { PracticeProblemsSkeleton } from "./PracticeProblemsSkeleton";
import { QuizSkeleton } from "./QuizSkeleton";
import { RoadmapSkeleton } from "./RoadmapSkeleton";
import { SlidesSkeleton } from "./SlidesSkeleton";

export interface MaterialViewerSkeletonProps {
  kind?: StudyMaterialKind | null;
}

function ViewerHeaderSkeleton() {
  return (
    <div
      data-slot="material-viewer-header-skeleton"
      className="flex min-h-[44px] shrink-0 items-center justify-between gap-2 bg-panel-header-bg p-1.5 select-none"
      aria-hidden="true"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Skeleton className="h-8 w-10 shrink-0 rounded-lg" />
        <Skeleton className="h-4 min-w-0 flex-1 rounded-full sm:max-w-64 sm:flex-none sm:basis-64" />
      </div>
      <div className="flex items-center gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

function GenericMaterialSkeleton() {
  return (
    <div
      data-slot="material-skeleton-generic"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      aria-hidden="true"
    >
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

const SKELETON_COMPONENTS: Partial<Record<StudyMaterialKind, React.ComponentType>> = {
  quiz: QuizSkeleton,
  simple_flashcard: FlashcardSkeleton,
  slides: SlidesSkeleton,
  roadmap: RoadmapSkeleton,
  mind_map: MindMapSkeleton,
  practice_problems: PracticeProblemsSkeleton,
  case_study: CaseStudySkeleton,
};

function KindSkeleton({ kind }: { kind?: StudyMaterialKind | null }) {
  const Component = kind ? SKELETON_COMPONENTS[kind] : undefined;
  if (!Component) return <GenericMaterialSkeleton />;
  return <Component />;
}

export function MaterialViewerSkeleton({ kind }: MaterialViewerSkeletonProps) {
  const label = kind ? `Loading ${kind.replace("_", " ")}` : "Loading study material";

  return (
    <div
      data-slot="material-viewer-skeleton"
      className="flex h-full flex-col overflow-hidden bg-surface-1 text-text-primary motion-reduce:animate-none"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <ViewerHeaderSkeleton />
      <div className="flex-1 overflow-hidden p-3 sm:p-4 md:p-6">
        <KindSkeleton kind={kind} />
      </div>
      <span className="sr-only">Loading study material…</span>
    </div>
  );
}
