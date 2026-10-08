import { AppHeader } from "@/components/layout";
// Direct import: the @/features/notebook-library barrel pulls the full library
// (dnd-kit, mutation hooks) into the pending chunk; only the skeleton
// primitives are needed to render the hero and grid placeholders.
import {
  LibraryGridSkeleton,
  LibraryHeroSkeleton,
} from "@/features/notebook-library/components/library-skeleton";

export function HomePageSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader />
      <main className="w-full mx-auto max-w-360 px-3 sm:px-6 lg:px-8 pb-12">
        <LibraryHeroSkeleton />
        <LibraryGridSkeleton />
      </main>
    </div>
  );
}
