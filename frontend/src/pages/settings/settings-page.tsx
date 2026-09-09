import { AppHeader } from "@/components/layout";
import { AppearanceCard, GatewayCard } from "@/features/settings";

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-260 px-5 pb-16 pt-10 sm:px-8 lg:pt-14">
        <header className="flex flex-col gap-6 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-none tracking-[-0.055em] sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Every notebook ships with models through the Vercel AI Gateway.
            </p>
          </div>
        </header>

        <section className="mt-9" aria-labelledby="gateway-heading">
          <div className="mb-3 px-1">
            <h2 id="gateway-heading" className="text-base font-semibold tracking-[-0.02em]">
              AI Gateway
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One gateway for every model. Bring your own key.
            </p>
          </div>
          <GatewayCard />
        </section>

        <section className="mt-8" aria-labelledby="appearance-heading">
          <div className="mb-3 px-1">
            <h2 id="appearance-heading" className="text-base font-semibold tracking-[-0.02em]">
              Appearance
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose how Memsystems looks. Theme sets the palette, color scheme sets light or dark.
            </p>
          </div>
          <AppearanceCard />
        </section>
      </main>
    </div>
  );
}
