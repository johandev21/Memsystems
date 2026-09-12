import type { LucideProps } from "lucide-react";
import { BookOpen } from "lucide-react";
import type { IconName } from "lucide-react/dynamic";
import { DynamicIcon as LucideDynamicIcon, dynamicIconImports } from "lucide-react/dynamic";
import { cn } from "@/shared/utils/cn";

export interface DynamicIconProps extends Omit<LucideProps, "ref" | "name"> {
  name?: string | null;
  fallbackIcon?: typeof BookOpen;
}

// The icon mounts only after the lazy lucide map chunk resolves; fade it in
// so it doesn't pop over content that rendered first.
const MOUNT_FADE = "animate-in fade-in motion-reduce:animate-none";

export function DynamicIcon({
  name,
  fallbackIcon: Fallback = BookOpen,
  ...props
}: DynamicIconProps) {
  const normalized = (name || "notebook")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

  const isValid = normalized in dynamicIconImports;
  const className = cn(MOUNT_FADE, props.className);

  if (!isValid) {
    return <Fallback {...props} className={className} />;
  }

  const fallback = () => <Fallback {...props} className={className} />;

  return (
    <LucideDynamicIcon
      name={normalized as IconName}
      fallback={fallback}
      {...props}
      className={className}
    />
  );
}
