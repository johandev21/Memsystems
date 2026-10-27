import { lazy, Suspense } from "react";
import { cn } from "@/shared/utils/cn";
import type { LucideProps } from "lucide-react";
import type { IconName } from "lucide-react/dynamic";
import type { BookOpen } from "lucide-react";

const DynamicIconImpl = lazy(() =>
  import("./dynamic-icon-impl").then((m) => ({ default: m.DynamicIcon })),
);

export interface DynamicIconProps extends Omit<LucideProps, "ref" | "name"> {
  name?: string | null;
  fallbackIcon?: typeof BookOpen;
}

function IconPlaceholder({ className, size }: DynamicIconProps) {
  const px = typeof size === "number" ? size : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block w-(--icon-size) h-(--icon-size)", className)}
      style={{
        "--icon-size": px !== undefined ? `${px}px` : (size ?? "1em"),
      } as React.CSSProperties}
    />
  );
}

export function DynamicIcon(props: DynamicIconProps) {
  return (
    <Suspense fallback={<IconPlaceholder {...props} />}>
      <DynamicIconImpl {...props} />
    </Suspense>
  );
}

export type { IconName };
