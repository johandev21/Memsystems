import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { Logo } from "./logo";

export function AppHeader() {
  return (
    <header className="flex items-center justify-center bg-background px-6 py-2">
      <div className="flex w-full max-w-360 items-center justify-between px-6">
        <Link to="/" className="flex cursor-pointer items-center gap-1.5 select-none">
          <Logo className="size-6 text-foreground" />
          <span className="font-heading text-sm font-bold tracking-tight text-foreground">
            Memsystems
          </span>
        </Link>
        <Link
          to="/settings"
          aria-label="Settings"
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-5" />
        </Link>
      </div>
    </header>
  );
}
