import { SchemeSelector, ThemeGrid } from "@/features/theme";

export function AppearanceCard() {
  return (
    <div className="space-y-8">
      <SchemeSelector />
      <ThemeGrid />
    </div>
  );
}
