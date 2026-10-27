import type { DynamicIconProps } from "./icon-picker/dynamic-icon";
import { DynamicIcon } from "./icon-picker/dynamic-icon";

export type NotebookIconProps = DynamicIconProps;

export function NotebookIcon(props: NotebookIconProps) {
  return <DynamicIcon {...props} />;
}

