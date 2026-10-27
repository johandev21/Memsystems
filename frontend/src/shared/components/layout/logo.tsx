import type React from "react";
import { cn } from "@/shared/utils/cn";
import memsystemsLogo from "./Memsystems.svg";

export function Logo({
  "aria-label": ariaLabel = "Memsystems",
  className,
  style,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "inline-block shrink-0 bg-current",
        "[-webkit-mask-position:center] [mask-position:center] [-webkit-mask-repeat:no-repeat] [mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-size:contain] [mask-image:var(--logo-mask)] [-webkit-mask-image:var(--logo-mask)]",
        className,
      )}
      style={{ "--logo-mask": `url(${memsystemsLogo})`, ...style } as React.CSSProperties}
      {...props}
    />
  );
}
