import type { LucideProps } from "lucide-react";
import { BookOpen } from "lucide-react";
import type { IconName } from "lucide-react/dynamic";
import { DynamicIcon as LucideDynamicIcon, dynamicIconImports } from "lucide-react/dynamic";

export interface DynamicIconProps extends Omit<LucideProps, "ref" | "name"> {
  name?: string | null;
  fallbackIcon?: typeof BookOpen;
}

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

  if (!isValid) {
    return <Fallback {...props} />;
  }

  const fallback = () => <Fallback {...props} />;

  return <LucideDynamicIcon name={normalized as IconName} fallback={fallback} {...props} />;
}
