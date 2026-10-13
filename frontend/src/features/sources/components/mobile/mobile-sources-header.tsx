import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MobileSourcesHeader({
  folderName,
  onBack,
}: {
  folderName?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation("sources");

  if (!folderName) {
    return null;
  }

  return (
    <header
      data-slot="sources-panel-header"
      className="flex min-h-11 shrink-0 items-center gap-1 bg-background p-1.5"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label={t("mobile.back", "Back")}
        className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-transform active:scale-97 touch-manipulation after:absolute after:-inset-1.5 after:content-['']"
      >
        <ChevronLeft className="size-4" />
      </button>
      <h2 className="truncate text-sm font-semibold">
        {folderName}
      </h2>
    </header>
  );
}
