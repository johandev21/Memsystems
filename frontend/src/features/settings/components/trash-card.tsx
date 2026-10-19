import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TrashModal } from "@/features/trash/components/trash-modal";

export function TrashCard() {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex flex-col gap-2.5 rounded-selector border border-border bg-card p-2.5 text-left transition-all hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer select-none"
        aria-label={t("trash.action")}
      >
        <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/20 p-2">
          <Trash2 className="size-9 text-muted-foreground" aria-hidden="true" />
        </div>
        <span className="flex items-center justify-between gap-2 px-0.5">
          <span className="min-w-0">
            <span className="block truncate text-base font-medium text-foreground">
              {t("trash.title")}
            </span>
            <span className="block text-sm leading-5 text-muted-foreground">
              {t("trash.cardDescription")}
            </span>
          </span>
        </span>
      </button>

      <TrashModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
