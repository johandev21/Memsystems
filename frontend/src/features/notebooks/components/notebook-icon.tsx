import type { DynamicIconProps } from "@/components/ui/dynamic-icon";
import { DynamicIcon } from "@/components/ui/dynamic-icon";

export type NotebookIconProps = DynamicIconProps;

export function NotebookIcon(props: NotebookIconProps) {
  return <DynamicIcon {...props} />;
}

