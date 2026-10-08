import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/layout";
import { AppearanceCard, LanguageCard } from "@/features/settings";

export function SettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <AppHeader />
      <main className="w-full mx-auto max-w-260 px-3 sm:px-6 lg:px-8 pb-16 pt-6 sm:pt-10 lg:pt-14">
        <header className="mb-10">
          <div>
            <h1 className="text-3xl font-semibold leading-none tracking-tighter sm:text-4xl">
              {t("page.title")}
            </h1>
          </div>
        </header>

        <section aria-labelledby="appearance-heading">
          <div className="mb-6">
            <h2 id="appearance-heading" className="text-base font-semibold tracking-tight">
              {t("appearance.title")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("appearance.description")}
            </p>
          </div>
          <AppearanceCard />
        </section>

        <section className="mt-12" aria-labelledby="language-heading">
          <div className="mb-6">
            <h2 id="language-heading" className="text-base font-semibold tracking-tight">
              {t("language.title")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("language.description")}
            </p>
          </div>
          <LanguageCard />
        </section>
      </main>
    </div>
  );
}
