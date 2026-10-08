import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";
import { SettingsLink } from "./settings-link";

export function AppHeader() {
  return (
    <header className="flex w-full items-center justify-center bg-background pb-2 pt-safe">
      <div className="flex w-full max-w-360 items-center justify-between px-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex cursor-pointer items-center gap-1.5 select-none" aria-label="Memsystems">
          <Logo className="size-6 text-foreground" />
          <span className="hidden font-heading text-sm font-bold tracking-tight text-foreground sm:inline">
            Memsystems
          </span>
        </Link>
        <SettingsLink />
      </div>
    </header>
  );
}
