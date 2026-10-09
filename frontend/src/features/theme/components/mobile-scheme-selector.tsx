import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

const SCHEME_OPTIONS = [
  { value: "light", labelKey: "scheme.light", icon: Sun },
  { value: "dark", labelKey: "scheme.dark", icon: Moon },
  { value: "system", labelKey: "scheme.system", icon: Monitor },
] as const;

export function MobileSchemeSelector() {
  const { t } = useTranslation("theme");
  const { theme, setTheme } = useTheme();
  const current = theme ?? "system";

  return (
    <div
      role="radiogroup"
      aria-label={t("scheme.title")}
      className="grid grid-cols-3 gap-1 rounded-2xl border border-border/40 bg-muted/60 p-1"
    >
      {SCHEME_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = current === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-medium transition-all duration-150 touch-manipulation select-none active:scale-97 cursor-pointer",
              selected
                ? "bg-card text-foreground shadow-xs font-semibold ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t(opt.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
