import { Logo } from "@/components/layout";
import { Check } from "lucide-react";
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
        <h3 className="text-base font-semibold tracking-[-0.01em]">{t("grid.title")}</h3>
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
      className={`group relative flex flex-col gap-2.5 rounded-[20px] border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected
          ? "border-primary bg-card shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/10"
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
        <span
          className={`ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-transparent bg-muted text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
          }`}
          aria-hidden="true"
        >
          {selected ? (
            <Check className="size-3.5" />
          ) : (
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </span>
      </span>
    </button>
  );
}

function ThemePreviewIcon({
  light,
  dark,
  accentLight,
  accentDark,
}: {
  light: string;
  dark: string;
  accentLight: string;
  accentDark: string;
}) {
  return (
    <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/20 p-2">
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-75"
        style={{
          background: `radial-gradient(circle at 50% 50%, color-mix(in oklch, ${accentLight} 25%, transparent) 0%, transparent 70%)`,
        }}
        aria-hidden="true"
      />
      {/* canvas */}
      <div className="relative h-11 w-20">
        {/* dark icon — back */}
        <Logo
          className="absolute right-0 top-1/2 size-11 -translate-y-1/2 transition-transform duration-300 group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${accentDark} 0%, color-mix(in oklch, ${accentDark} 40%, ${dark}) 50%, ${dark} 100%)`,
            filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4))",
          }}
          aria-hidden="true"
        />
        {/* light icon — front overlapping */}
        <Logo
          className="absolute left-0 top-1/2 z-10 size-11 -translate-y-1/2 transition-transform duration-300 group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${light} 0%, ${accentLight} 55%, color-mix(in oklch, ${accentLight} 70%, black) 100%)`,
            filter: "drop-shadow(0 3px 8px rgba(0, 0, 0, 0.22))",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
