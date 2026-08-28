import { NotebooksSection } from "./notebooks-section";
import { AppHeader } from "@/components/layout";

export function HomePage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-360 px-6 pb-12">
        <NotebooksSection />
      </main>
    </div>
  );
}
