import { AppHeader } from "@/components/layout";
// Direct import: the @/features/notebooks barrel re-exports the notebook
// studio workspace (MaterialViewer + AI SDK), which would drag ~600 KB of
// lazy-only code into the eagerly-loaded home route.
import { RecentNotebooksSection } from "@/features/notebooks/components/recent-notebooks-section";

export function HomePage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-360 px-6 pb-12">
        <RecentNotebooksSection />
      </main>
    </div>
  );
}
