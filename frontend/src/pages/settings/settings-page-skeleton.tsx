import { AppHeader } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsSectionSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-5 w-full max-w-2xl" />
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <AppHeader />
      <main className="w-full mx-auto max-w-260 px-3 sm:px-6 lg:px-8 pb-16 pt-6 sm:pt-10 lg:pt-14">
        <header className="mb-10" aria-hidden="true">
          <Skeleton className="h-10 w-44" />
        </header>

        <section aria-hidden="true">
          <SettingsSectionSkeleton />
        </section>
        <section className="mt-12" aria-hidden="true">
          <SettingsSectionSkeleton />
        </section>
        <section className="mt-12" aria-hidden="true">
          <SettingsSectionSkeleton />
        </section>
        <section className="mt-12" aria-hidden="true">
          <SettingsSectionSkeleton />
        </section>
      </main>
    </div>
  );
}
