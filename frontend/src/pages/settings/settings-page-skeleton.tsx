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

function MobileSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-24 w-full" aria-hidden="true">
      <div className="sticky top-0 z-20 flex flex-col pt-4 bg-background/95 backdrop-blur-xs w-full">
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-48 rounded-md" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16 rounded-md" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-44 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="sm:hidden w-full px-3">
        <MobileSettingsSkeleton />
      </div>

      <div className="hidden sm:flex flex-col w-full">
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
    </div>
  );
}
