import { Check } from "lucide-react";
import { THEMES, type ThemeName } from "../model/themes";
import { usePalette } from "../model/use-palette";

function ThemePreviewOrbs({
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
      {/* canvas */}
      <div className="relative h-11 w-20">
        {/* dark orb — back */}
        <div
          className="absolute right-0 top-1/2 size-11 -translate-y-1/2 rounded-full ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-105 dark:ring-white/15"
          style={{
            background: `
              radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 32%),
              radial-gradient(circle at 35% 35%, ${accentDark} 0%, color-mix(in oklch, ${accentDark} 45%, ${dark}) 45%, ${dark} 85%, color-mix(in oklch, ${dark}, black 25%) 100%)
            `,
            boxShadow:
              "inset 0 1px 1.5px rgba(255, 255, 255, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.3)",
          }}
          aria-hidden="true"
        />
        {/* light orb — front overlapping */}
        <div
          className="absolute left-0 top-1/2 z-10 size-11 -translate-y-1/2 rounded-full ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-105 dark:ring-white/20"
          style={{
            background: `
              radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 35%),
              radial-gradient(circle at 35% 35%, ${accentLight} 0%, color-mix(in oklch, ${accentLight} 35%, ${light}) 42%, ${light} 82%, color-mix(in oklch, ${light}, black 12%) 100%)
            `,
            boxShadow:
              "inset 0 1.5px 2px rgba(255, 255, 255, 0.9), inset 0 -2px 4px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.25)",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

interface ThemeCardProps {
  id: ThemeName;
  label: string;
  description: string;
  preview: { light: string; dark: string; accentLight: string; accentDark: string };
  selected: boolean;
  onSelect: () => void;
}

function ThemeCard({ label, description, preview, selected, onSelect }: ThemeCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${label}${selected ? ", selected" : ""}`}
      onClick={onSelect}
      className={`group relative flex flex-col gap-2.5 rounded-[20px] border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected
          ? "border-primary bg-card shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/10"
      }`}
    >
      <ThemePreviewOrbs {...preview} />
      <span className="flex items-center justify-between gap-2 px-0.5">
        <span className="min-w-0">
          <span className={`block truncate text-sm font-medium ${selected ? "text-foreground" : "text-foreground"}`}>{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        </span>
        <span
          className={`ml-auto flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
            selected ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-muted text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
          }`}
          aria-hidden="true"
        >
          {selected ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
        </span>
      </span>
    </button>
  );
}

export function ThemeGrid() {
  const { theme, setTheme, themes } = usePalette();

  // Ensure we render from canonical THEMES but allow themes prop override
  const list = themes?.length ? themes : THEMES;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">Themes</h3>
        <span className="text-xs text-muted-foreground">6 palettes · each has light &amp; dark</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Theme">
        {list.map((t) => (
          <ThemeCard
            key={t.id}
            id={t.id}
            label={t.label}
            description={t.description}
            preview={t.preview}
            selected={theme === t.id}
            onSelect={() => setTheme(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
