import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/shared/utils/cn";

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
        "flex flex-1 flex-col justify-between gap-5 sm:min-h-95 animate-in fade-in slide-in-from-right-2 duration-150",
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
  return <div className={cn("flex flex-1 flex-col gap-5", className)}>{children}</div>;
}

export function BriefStepFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/40 sm:border-transparent pt-3 pb-safe sm:pb-0">
      {children}
    </div>
  );
}

export function BriefStepHint({ children }: { children: ReactNode }) {
  return <span className="hidden sm:inline min-w-0 text-xs text-text-faint">{children}</span>;
}

export function BriefFieldLabel({
  children,
  required = false,
  className,
}: {
  children: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <Label className={cn("text-sm font-medium text-text-primary", className)}>
      <span className="sm:hidden">{children.replace(/^\d+\.\s*/, "")}</span>
      <span className="hidden sm:inline">{children}</span>
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );
}

type BriefNavButtonProps = Omit<ComponentProps<typeof Button>, "className" | "variant" | "type">;

export function BriefNextButton(props: BriefNavButtonProps) {
  return (
    <Button
      variant="surface"
      type="button"
      className="min-h-12 sm:min-h-9 h-12 sm:h-9 w-full sm:w-auto cursor-pointer gap-2 rounded-xl sm:rounded-full px-5 text-sm font-semibold sm:font-medium transition-transform transition-colors active:scale-[0.98] touch-manipulation"
      {...props}
    />
  );
}

export function BriefBackButton(props: BriefNavButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-12 sm:min-h-9 h-12 sm:h-9 cursor-pointer gap-1.5 rounded-xl px-4 text-sm font-medium sm:font-normal text-text-secondary sm:text-text-faint hover:text-text-secondary transition-transform active:scale-97 touch-manipulation"
      {...props}
    />
  );
}

export function BriefSubmitButton(props: BriefNavButtonProps) {
  return (
    <Button
      variant="surface"
      type="button"
      className="min-h-12 sm:min-h-9 h-12 sm:h-9 w-full sm:w-auto cursor-pointer gap-2 rounded-xl sm:rounded-full px-6 text-sm font-semibold sm:font-medium transition-transform transition-colors active:scale-[0.98] touch-manipulation"
      {...props}
    />
  );
}
