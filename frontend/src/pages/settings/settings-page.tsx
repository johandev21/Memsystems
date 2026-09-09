import { AppHeader } from "@/components/layout";
import { AppearanceCard, GatewayCard } from "@/features/settings";

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-260 px-5 pb-16 pt-10 sm:px-8 lg:pt-14">
        <header className="mb-10">
          <div>
            <h1 className="text-3xl font-semibold leading-none tracking-[-0.055em] sm:text-4xl">
              Settings
            </h1>
          </div>
        </header>

        <section aria-labelledby="gateway-heading">
          <GatewayCard />
        </section>

        <section className="mt-12" aria-labelledby="appearance-heading">
          <div className="mb-6">
            <h2 id="appearance-heading" className="text-base font-semibold tracking-[-0.02em]">
              Appearance
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Choose how Memsystems looks. Theme sets the palette, color scheme sets light or dark.
            </p>
          </div>
          <AppearanceCard />
        </section>
      </main>
    </div>
  );
}
