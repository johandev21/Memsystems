import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TrashModal } from "@/features/trash";

export function TrashCard() {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex flex-col gap-2.5 rounded-selector border border-border bg-card p-2.5 text-left motion-chrome duration-150 ease-in-out hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer select-none max-sm:min-h-11 max-sm:flex-row max-sm:items-center max-sm:rounded-xl max-sm:touch-manipulation max-sm:active:scale-97"
        aria-label={t("trash.action")}
      >
        <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/20 p-2 max-sm:h-auto max-sm:w-auto max-sm:shrink-0 max-sm:bg-transparent max-sm:p-0">
          <Trash2 className="size-9 text-muted-foreground max-sm:size-5" aria-hidden="true" />
        </div>
        <span className="flex items-center justify-between gap-2 px-0.5 max-sm:min-w-0 max-sm:flex-1">
          <span className="min-w-0">
            <span className="block truncate text-base font-medium text-foreground max-sm:text-xs">
              {t("trash.title")}
            </span>
            <span className="block text-sm leading-5 text-muted-foreground max-sm:text-xs">
              {t("trash.cardDescription")}
            </span>
          </span>
        </span>
      </button>

      <TrashModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
