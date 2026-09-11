import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import { ImageIcon, Monitor, PlusIcon } from "lucide-react";
import { type ComponentProps, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { capturePromptInputScreenshot } from "../../utils/prompt-input-screenshot";
import { usePromptInputAttachments } from "./prompt-input-context";
import { PromptInputButton, type PromptInputButtonProps } from "./prompt-input-buttons";

export type PromptInputActionAddAttachmentsProps = ComponentProps<typeof DropdownMenuItem> & {
  label?: string;
};

export const PromptInputActionAddAttachments = ({
  label,
  className,
  ...props
}: PromptInputActionAddAttachmentsProps) => {
  const { t } = useTranslation("ai");
  const attachments = usePromptInputAttachments();
  const resolvedLabel = label ?? t("promptInput.addPhotosOrFiles");

  const handleSelect = useCallback(
    (e: unknown) => {
      if (e instanceof Event) e.preventDefault();
      attachments.openFileDialog();
    },
    [attachments],
  );

  return (
    <DropdownMenuItem
      className={cn("whitespace-nowrap cursor-pointer", className)}
      {...props}
      onSelect={handleSelect}
    >
      <ImageIcon className="mr-2 size-4 shrink-0" /> {resolvedLabel}
    </DropdownMenuItem>
  );
};

export type PromptInputActionAddScreenshotProps = ComponentProps<typeof DropdownMenuItem> & {
  label?: string;
};

export const PromptInputActionAddScreenshot = ({
  label,
  onSelect,
  ...props
}: PromptInputActionAddScreenshotProps) => {
  const { t } = useTranslation("ai");
  const attachments = usePromptInputAttachments();
  const resolvedLabel = label ?? t("promptInput.takeScreenshot");

  const handleSelect = useCallback(
    async (event: unknown) => {
      if (event instanceof Event) {
        onSelect?.(event as any);
      }
      if (event instanceof Event && event.defaultPrevented) {
        return;
      }

      try {
        const screenshot = await capturePromptInputScreenshot();
        if (screenshot) {
          attachments.add([screenshot]);
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "NotAllowedError" || error.name === "AbortError")
        ) {
          return;
        }
        throw error;
      }
    },
    [onSelect, attachments],
  );

  return (
    <DropdownMenuItem {...props} onSelect={handleSelect}>
      <Monitor className="mr-2 size-4" />
      {resolvedLabel}
    </DropdownMenuItem>
  );
};

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
  <DropdownMenu {...props} />
);

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) => (
  <DropdownMenuTrigger render={<span />}>
    <PromptInputButton className={className} {...props}>
      {children ?? <PlusIcon className="size-4" />}
    </PromptInputButton>
  </DropdownMenuTrigger>
);

export type PromptInputActionMenuContentProps = ComponentProps<typeof DropdownMenuContent>;
export const PromptInputActionMenuContent = ({
  className,
  align = "start",
  side = "top",
  sideOffset = 8,
  ...props
}: PromptInputActionMenuContentProps) => (
  <DropdownMenuContent
    align={align}
    side={side}
    sideOffset={sideOffset}
    className={cn("w-auto min-w-max", className)}
    {...props}
  />
);

export type PromptInputActionMenuItemProps = ComponentProps<typeof DropdownMenuItem>;
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps) => <DropdownMenuItem className={cn(className)} {...props} />;
