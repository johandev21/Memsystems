import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MobileSettingsHeader() {
  const { t } = useTranslation("settings");

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-2 bg-background/95 pb-2 pt-safe backdrop-blur-xs w-full">
      <div className="flex items-center justify-between gap-2 w-full">
        <Link
          to="/"
          className="group inline-flex items-center gap-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-97 touch-manipulation cursor-pointer select-none"
          aria-label={t("nav.back")}
        >
          <ChevronLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span className="truncate">{t("nav.back")}</span>
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
        {t("page.title")}
      </h1>
    </header>
  );
}
