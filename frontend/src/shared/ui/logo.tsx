import type React from "react";
import { cn } from "@/shared/lib/utils";
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
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        WebkitMaskImage: `url(${memsystemsLogo})`,
        maskImage: `url(${memsystemsLogo})`,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        ...style,
      }}
      {...props}
    />
  );
}
