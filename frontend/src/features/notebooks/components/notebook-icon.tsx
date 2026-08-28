import type { LucideProps } from "lucide-react";
import { BookOpen } from "lucide-react";
import type { IconName } from "lucide-react/dynamic";
import { DynamicIcon, dynamicIconImports } from "lucide-react/dynamic";

interface NotebookIconProps extends Omit<LucideProps, "ref" | "name"> {
  name?: string | null;
}

export function NotebookIcon({ name, ...props }: NotebookIconProps) {
  const normalized = (name || "notebook").toLowerCase().trim().replace(/\s+/g, "-");

  const isValid = normalized in dynamicIconImports;

  if (!isValid) {
    return <BookOpen {...props} />;
  }

  const fallback = () => <BookOpen {...props} />;

  return <DynamicIcon name={normalized as IconName} fallback={fallback} {...props} />;
}
