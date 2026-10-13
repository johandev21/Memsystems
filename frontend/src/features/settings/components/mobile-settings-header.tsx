import { useTranslation } from "react-i18next";

export function MobileSettingsHeader() {
  const { t } = useTranslation("settings");

  return (
    <header className="sticky top-0 z-20 flex flex-col pt-4 bg-background/95 backdrop-blur-xs w-full">
      <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
        {t("page.title")}
      </h1>
    </header>
  );
}
