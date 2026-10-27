import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && (
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-muted/50">
          {icon}
        </div>
      )}
      <p className="mb-1 text-sm font-semibold">{title}</p>
      <p className="mb-5 max-w-xs text-xs text-muted-foreground leading-relaxed">{description}</p>
      {children}
    </div>
  );
}
