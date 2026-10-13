import { useState } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

export interface MobileCreatePromptDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onConfirm: (name: string) => void | Promise<void>;
  isSubmitting?: boolean;
  maxLength?: number;
}

export function MobileCreatePromptDrawer({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  initialValue = "",
  submitLabel,
  cancelLabel,
  onConfirm,
  isSubmitting = false,
  maxLength = 200,
}: MobileCreatePromptDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          onOpenChange(next);
        }
      }}
    >
      <DrawerContent className="p-4 pb-safe-lg bg-background text-foreground" showCloseButton={false}>
        {open && (
          <CreatePromptForm
            title={title}
            description={description}
            placeholder={placeholder}
            initialValue={initialValue}
            submitLabel={submitLabel}
            cancelLabel={cancelLabel}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
            isSubmitting={isSubmitting}
            maxLength={maxLength}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function CreatePromptForm({
  title,
  description,
  placeholder,
  initialValue,
  submitLabel,
  cancelLabel,
  onCancel,
  onConfirm,
  isSubmitting,
  maxLength = 200,
}: {
  title: string;
  description?: string;
  placeholder?: string;
  initialValue: string;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (name: string) => void | Promise<void>;
  isSubmitting: boolean;
  maxLength?: number;
}) {
  const { t } = useTranslation(["common", "notebooks"]);
  const [value, setValue] = useState(initialValue);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;
    void onConfirm(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DrawerHeader className="p-0 text-left shrink-0">
        <DrawerTitle className="text-base font-semibold text-foreground">{title}</DrawerTitle>
        {description && (
          <DrawerDescription className="text-xs text-muted-foreground mt-0.5">
            {description}
          </DrawerDescription>
        )}
      </DrawerHeader>

      <div className="relative flex items-center">
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={title}
          enterKeyHint="done"
          disabled={isSubmitting}
          className="h-12 w-full px-3.5 text-base sm:text-sm bg-muted/40 border-border/80 focus-visible:bg-muted/70 pr-10"
        />
        {value.length > 0 && !isSubmitting && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-3 size-5 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 flex items-center justify-center text-muted-foreground active:scale-95 touch-manipulation cursor-pointer"
            aria-label={t("common:clear", "Clear")}
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl text-sm font-medium touch-manipulation active:scale-97 cursor-pointer"
        >
          {cancelLabel ?? t("common:cancel", "Cancel")}
        </Button>
        <Button
          type="submit"
          disabled={!value.trim() || isSubmitting}
          className="flex-1 h-11 rounded-xl text-sm font-medium touch-manipulation active:scale-97 cursor-pointer"
        >
          {submitLabel ?? t("common:create", "Create")}
        </Button>
      </div>
    </form>
  );
}
