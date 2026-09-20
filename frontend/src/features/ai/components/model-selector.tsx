import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/shared/utils/cn";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type ModelSelectorProps = ComponentProps<typeof Dialog>;

export const ModelSelector = (props: ModelSelectorProps) => <Dialog {...props} />;

export type ModelSelectorTriggerProps = ComponentProps<typeof DialogTrigger>;

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <DialogTrigger {...props} />
);

export type ModelSelectorContentProps = ComponentProps<typeof DialogContent> & {
  title?: ReactNode;
};

export const ModelSelectorContent = ({
  className,
  children,
  title,
  ...props
}: ModelSelectorContentProps) => {
  const { t } = useTranslation("ai");

  return (
    <DialogContent
      aria-describedby={undefined}
      className={cn(
        "outline! border border-border! p-0 outline-border! outline-solid! overflow-hidden rounded-2xl bg-popover shadow-2xl [&>button]:top-2",
        className,
      )}
      {...props}
    >
      <DialogTitle className="sr-only">{title ?? t("modelSelector.title")}</DialogTitle>
      <Command className="**:data-[slot=command-input-wrapper]:h-auto [&_[cmdk-input-wrapper]]:border-0">
        {children}
      </Command>
    </DialogContent>
  );
};

export type ModelSelectorDialogProps = ComponentProps<typeof CommandDialog>;

export const ModelSelectorDialog = (props: ModelSelectorDialogProps) => (
  <CommandDialog {...props} />
);

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>;

export const ModelSelectorInput = ({ className, ...props }: ModelSelectorInputProps) => (
  <CommandInput className={cn("h-11 rounded-none border-0 px-3", className)} {...props} />
);

export type ModelSelectorListProps = ComponentProps<typeof CommandList>;

export const ModelSelectorList = (props: ModelSelectorListProps) => <CommandList {...props} />;

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => <CommandEmpty {...props} />;

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => <CommandGroup {...props} />;

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>;

export const ModelSelectorItem = (props: ModelSelectorItemProps) => <CommandItem {...props} />;

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<typeof CommandSeparator>;

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
);

export type ModelSelectorLogoProps = Omit<ComponentProps<"span">, "aria-label"> & {
  provider: string;
};

export const ModelSelectorLogo = ({ provider, className, ...props }: ModelSelectorLogoProps) => {
  const { t } = useTranslation("ai");

  return (
    <span
      {...props}
      aria-label={t("modelSelector.providerLogo", { provider })}
      className={cn(
        "size-4.5 shrink-0 bg-(--model-icon-color) text-(--model-icon-color)",
        "[mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [mask-image:var(--model-mask)]",
        "[-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [-webkit-mask-image:var(--model-mask)]",
        className,
      )}
      style={{ "--model-mask": `url(https://models.dev/logos/${provider}.svg)` } as React.CSSProperties}
    />
  );
};

export type ModelSelectorLogoGroupProps = ComponentProps<"div">;

export const ModelSelectorLogoGroup = ({ className, ...props }: ModelSelectorLogoGroupProps) => (
  <div
    className={cn(
      "flex shrink-0 items-center -space-x-1 [&>span]:rounded-full [&>span]:bg-background [&>span]:p-px [&>span]:ring-1 dark:[&>span]:bg-foreground",
      className,
    )}
    {...props}
  />
);

export type ModelSelectorNameProps = ComponentProps<"span">;

export const ModelSelectorName = ({ className, ...props }: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
);
