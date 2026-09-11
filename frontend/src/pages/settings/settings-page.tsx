import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/layout";
import { AppearanceCard, GatewayCard, LanguageCard } from "@/features/settings";

export function SettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-260 px-5 pb-16 pt-10 sm:px-8 lg:pt-14">
        <header className="mb-10">
          <div>
            <h1 className="text-3xl font-semibold leading-none tracking-[-0.055em] sm:text-4xl">
              {t("page.title")}
            </h1>
          </div>
        </header>

        <section aria-labelledby="gateway-heading">
          <GatewayCard />
        </section>

        <section className="mt-12" aria-labelledby="appearance-heading">
          <div className="mb-6">
            <h2 id="appearance-heading" className="text-base font-semibold tracking-[-0.02em]">
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
            <h2 id="language-heading" className="text-base font-semibold tracking-[-0.02em]">
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
