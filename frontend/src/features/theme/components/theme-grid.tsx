import { Logo } from "@/components/layout";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { THEMES, type ThemeName } from "../utils/themes";
import { usePalette } from "../hooks/use-palette";

export function ThemeGrid() {
  const { t } = useTranslation("theme");
  const { theme, setTheme, themes } = usePalette();

  // Ensure we render from canonical THEMES but allow themes prop override
  const list = themes?.length ? themes : THEMES;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold tracking-tight">{t("grid.title")}</h3>
        <span className="text-xs text-muted-foreground">
          {t("grid.hint", { count: THEMES.length })}
        </span>
      </div>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        role="radiogroup"
        aria-label={t("grid.ariaLabel")}
      >
        {list.map((item) => {
          const selected = theme === item.id;
          return (
            <ThemeCard
              key={item.id}
              id={item.id}
              label={item.label}
              ariaLabel={selected ? t("grid.selected", { name: item.label }) : item.label}
              description={t(item.descriptionKey)}
              preview={item.preview}
              selected={selected}
              onSelect={() => setTheme(item.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface ThemeCardProps {
  id: ThemeName;
  label: string;
  ariaLabel: string;
  description: string;
  preview: { light: string; dark: string; accentLight: string; accentDark: string };
  selected: boolean;
  onSelect: () => void;
}

function ThemeCard({ label, ariaLabel, description, preview, selected, onSelect }: ThemeCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={`group relative flex flex-col gap-2.5 rounded-selector border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected
          ? "border-primary bg-card shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card hover:bg-card-hover"
      }`}
    >
      <ThemePreviewIcon {...preview} />
      <span className="flex items-center justify-between gap-2 px-0.5">
        <span className="min-w-0">
          <span
            className={`block truncate text-base font-medium ${selected ? "text-foreground" : "text-foreground"}`}
          >
            {label}
          </span>
          <span className="block text-sm leading-5 text-muted-foreground">{description}</span>
        </span>
      </span>
    </button>
  );
}

function ThemePreviewIcon({
  accentLight,
  accentDark,
}: {
  accentLight: string;
  accentDark: string;
}) {
  const { resolvedTheme } = useTheme();
  const accent = resolvedTheme === "dark" ? accentDark : accentLight;
  const fill = `radial-gradient(circle at 30% 28%, color-mix(in oklch, ${accent} 55%, white) 0%, ${accent} 55%, color-mix(in oklch, ${accent} 82%, black) 100%)`;

  return (
    <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/20 p-2">
      <Logo
        className="size-12 bg-theme-preview"
        style={{ "--tg-bg": fill } as React.CSSProperties}
        aria-hidden="true"
      />
    </div>
  );
}
