import type * as React from "react";
import { cn } from "@/shared/utils/cn";

function ButtonGroup({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      data-slot="button-group"
      className={cn("flex items-center", orientation === "vertical" && "flex-col", className)}
      {...props}
    />
  );
}

function ButtonGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="button-group-text"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupText };
