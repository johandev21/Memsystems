import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import { THEMES } from "../utils/themes";
import { usePalette } from "../hooks/use-palette";

export function MobileThemeGrid() {
  const { t } = useTranslation("theme");
  const { theme, setTheme, themes } = usePalette();
  const { resolvedTheme } = useTheme();

  const list = themes?.length ? themes : THEMES;

  return (
    <div
      role="radiogroup"
      aria-label={t("grid.ariaLabel")}
      className="grid grid-cols-2 gap-2"
    >
      {list.map((item) => {
        const selected = theme === item.id;
        const accent =
          resolvedTheme === "dark" ? item.preview.accentDark : item.preview.accentLight;
        const swatchFill = `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${accent} 55%, white) 0%, ${accent} 55%, color-mix(in oklch, ${accent} 82%, black) 100%)`;

        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={selected ? t("grid.selected", { name: item.label }) : item.label}
            onClick={() => setTheme(item.id)}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all duration-150 touch-manipulation select-none active:scale-97 cursor-pointer",
              selected
                ? "border-primary bg-card shadow-xs ring-1 ring-primary/25"
                : "border-border/60 bg-card hover:bg-card-hover",
            )}
          >
            <span
              className="size-5 shrink-0 rounded-full border border-black/10 shadow-2xs dark:border-white/15 bg-theme-preview"
              style={{ "--tg-bg": swatchFill } as React.CSSProperties}
              aria-hidden="true"
            />


            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {item.label}
            </span>
            {selected && (
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
