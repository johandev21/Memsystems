import { AppHeader } from "@/components/layout";
import { NotebookFoldersPrototype } from "@/features/notebook-folders-prototype";

export function NotebookFoldersPrototypePage() {
  return (
    <div className="notebook-folders-prototype min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-360 px-6 pb-12">
        <NotebookFoldersPrototype />
      </main>
    </div>
  );
}
