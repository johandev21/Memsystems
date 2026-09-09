import { SchemeSelector, ThemeGrid } from "@/features/theme";

export function AppearanceCard() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_30px_rgb(15_23_42/0.025)] sm:p-6">
      <div className="space-y-8">
        <SchemeSelector />
        <ThemeGrid />
      </div>
    </div>
  );
}
