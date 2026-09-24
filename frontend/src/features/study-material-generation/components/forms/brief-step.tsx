import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";

/**
 * Shared wizard shell pieces for the generation dialogs.
 *
 * The Quiz form is the reference: a two-step wizard whose step body keeps a
 * stable `min-h-95` frame with the footer pinned to the bottom. Every form
 * composes these pieces so the dialogs share the same height, rhythm, and
 * navigation feel.
 */

export function BriefStep({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-95 flex-col justify-between gap-5 animate-in fade-in slide-in-from-right-2 duration-150",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BriefStepFields({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-5", className)}>{children}</div>;
}

export function BriefStepFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-transparent pt-2">
      {children}
    </div>
  );
}

export function BriefStepHint({ children }: { children: ReactNode }) {
  return <span className="min-w-0 text-xs text-text-faint">{children}</span>;
}

/**
 * Navigation buttons for the wizard footers. The literal class strings live
 * here (not at the call sites) so every dialog keeps identical navigation and
 * the shadcn static-classes lint rule stays satisfied.
 */

type BriefNavButtonProps = Omit<ComponentProps<typeof Button>, "className" | "variant" | "type">;

export function BriefNextButton(props: BriefNavButtonProps) {
  return (
    <Button
      variant="surface"
      type="button"
      className="h-9 cursor-pointer gap-1.5 rounded-full px-5 text-sm font-medium transition-colors"
      {...props}
    />
  );
}

export function BriefBackButton(props: BriefNavButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-9 cursor-pointer gap-1.5 px-4 text-sm text-text-faint hover:text-text-secondary"
      {...props}
    />
  );
}

export function BriefSubmitButton(props: BriefNavButtonProps) {
  return (
    <Button
      variant="surface"
      type="button"
      className="h-10 cursor-pointer gap-2 rounded-full px-6 text-sm font-medium transition-colors"
      {...props}
    />
  );
}
