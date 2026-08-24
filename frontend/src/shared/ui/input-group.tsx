import type * as React from "react";
import { cn } from "@/shared/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "liquid-glass relative flex w-full items-center rounded-2xl border border-border bg-composer-bg shadow-sm transition-[box-shadow,border-color] focus-within:border-ring focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring/20",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({
  className,
  align,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end" | "block-start" | "block-end";
}) {
  return (
    <div data-slot="input-group-addon" className={cn("flex items-center", className)} {...props} />
  );
}

function InputGroupButton({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & { variant?: string; size?: string }) {
  return (
    <button
      data-slot="input-group-button"
      className={cn(
        "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-foreground text-background shadow-sm hover:bg-foreground/90",
        variant === "ghost" && "text-muted-foreground hover:bg-accent hover:text-foreground",
        size === "icon-sm" && "h-8 w-8",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="input-group-textarea"
      className={cn(
        "flex w-full bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted-foreground/70 placeholder:select-none disabled:cursor-not-allowed disabled:opacity-50 resize-none field-sizing-content min-h-[60px]",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea };
