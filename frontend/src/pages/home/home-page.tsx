import { AppHeader } from "@/components/layout";
import { RecentNotebooksSection } from "@/features/notebooks";

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
