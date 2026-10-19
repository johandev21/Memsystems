import { AppHeader } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { SUPPORTED_LANGUAGES } from "@/features/language/utils/languages";
import { THEMES } from "@/features/theme/utils/themes";

const SCHEME_OPTION_COUNT = 3;

function SchemeSelectorSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-28" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: SCHEME_OPTION_COUNT }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2.5 rounded-selector border border-border bg-card p-2.5"
          >
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="flex h-6 items-center gap-1.5 px-0.5">
              <Skeleton className="size-3.5 shrink-0 rounded-xs" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemeGridSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-20" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => (
          <div
            key={theme.id}
            className="flex flex-col gap-2.5 rounded-selector border border-border bg-card p-2.5"
          >
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="flex h-11 flex-col justify-center gap-1.5 px-0.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3.5 w-44 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LanguageSelectorSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <div
          key={lang.code}
          className="flex flex-col gap-2.5 rounded-selector border border-border bg-card p-2.5"
        >
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="flex h-6 items-center px-0.5">
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrashCardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-2.5 rounded-selector border border-border bg-card p-2.5">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="flex h-11 flex-col justify-center gap-1.5 px-0.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3.5 w-48 max-w-full" />
        </div>
      </div>
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
            {THEMES.map((theme) => (
              <Skeleton key={theme.id} className="h-11 w-full rounded-xl" />
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

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-3.5 w-52 rounded-md" />
        </div>
        <TrashCardSkeleton />
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
            <Skeleton className="h-9 sm:h-10 w-44" />
          </header>

          <section aria-hidden="true">
            <div className="mb-6">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="mt-1 h-6 w-72 max-w-full" />
            </div>
            <div className="space-y-8">
              <SchemeSelectorSkeleton />
              <ThemeGridSkeleton />
            </div>
          </section>

          <section className="mt-12" aria-hidden="true">
            <div className="mb-6">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="mt-1 h-6 w-64 max-w-full" />
            </div>
            <LanguageSelectorSkeleton />
          </section>

          <section className="mt-12" aria-hidden="true">
            <div className="mb-6">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="mt-1 h-6 w-80 max-w-full" />
            </div>
            <TrashCardSkeleton />
          </section>
        </main>
      </div>
    </div>
  );
}
