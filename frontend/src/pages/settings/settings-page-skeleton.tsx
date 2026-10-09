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
      {/* Header Skeleton */}
      <div className="sticky top-0 z-20 flex flex-col gap-2 bg-background/95 pb-2 pt-safe backdrop-blur-xs w-full">
        <div className="flex items-center gap-1.5 py-1">
          <Skeleton className="h-5 w-18 rounded-md" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      {/* Appearance Section */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-48 rounded-md" />
        </div>

        {/* Scheme segmented control */}
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>

        {/* Themes 2-column grid */}
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16 rounded-md" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Language Section */}
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
      {/* Mobile Skeleton */}
      <div className="sm:hidden w-full px-3">
        <MobileSettingsSkeleton />
      </div>

      {/* Desktop Skeleton */}
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
