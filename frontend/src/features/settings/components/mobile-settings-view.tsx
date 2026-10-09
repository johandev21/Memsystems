import { useTranslation } from "react-i18next";
import { MobileLanguageSelector } from "@/features/language";
import { MobileSchemeSelector, MobileThemeGrid } from "@/features/theme";
import { MobileSettingsHeader } from "./mobile-settings-header";

export function MobileSettingsView() {
  const { t } = useTranslation(["settings", "theme"]);

  return (
    <div className="flex flex-col gap-6 pb-24 w-full">
      <MobileSettingsHeader />

      <section aria-labelledby="mobile-appearance-heading" className="space-y-4">
        <div>
          <h2
            id="mobile-appearance-heading"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            {t("settings:appearance.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings:appearance.description")}
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("theme:scheme.title")}
          </span>
          <MobileSchemeSelector />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("theme:grid.title")}
          </span>
          <MobileThemeGrid />
        </div>
      </section>

      <section aria-labelledby="mobile-language-heading" className="space-y-4">
        <div>
          <h2
            id="mobile-language-heading"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            {t("settings:language.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settings:language.description")}
          </p>
        </div>

        <MobileLanguageSelector />
      </section>
    </div>
  );
}
