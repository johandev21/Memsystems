import { lazy, Suspense } from "react";
import type { LucideProps } from "lucide-react";
import type { IconName } from "lucide-react/dynamic";
import type { BookOpen } from "lucide-react";

// The dynamic icon implementation pulls lucide's full lazy-import map
// (~57 KB gz). Kept behind a lazy boundary so the notebook route doesn't
// download it just to render a few header icons.
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
      className={className}
      style={{
        display: "inline-block",
        width: px ?? size ?? "1em",
        height: px ?? size ?? "1em",
      }}
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
