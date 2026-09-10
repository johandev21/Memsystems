import { Link } from "@tanstack/react-router";
import { Logo, SettingsLink } from "@/components/layout";
import { EditableNotebookTitle } from "./editable-notebook-title";

export function NotebookHeader({ id }: { id: string }) {
  return (
    <header className="flex h-11 sm:h-12 items-center justify-between px-3 sm:px-4 lg:px-6 bg-background shrink-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Link
          to="/"
          className="flex items-center gap-1.5 hover:opacity-90 transition-opacity select-none shrink-0"
        >
          <Logo className="size-6 text-foreground" />
        </Link>
        <span className="hidden sm:inline text-muted-foreground/40 font-mono text-xs select-none shrink-0">
          /
        </span>
        <div className="min-w-0 flex-1">
          <EditableNotebookTitle id={id} />
        </div>
      </div>

      <div className="shrink-0">
        <SettingsLink />
      </div>
    </header>
  );
}
