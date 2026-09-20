import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { getThemeMeta } from "../utils/themes";
import { usePaletteOptional } from "../hooks/use-palette";

const SCHEME_OPTIONS = [
  { value: "light", labelKey: "scheme.light", icon: Sun },
  { value: "dark", labelKey: "scheme.dark", icon: Moon },
  { value: "system", labelKey: "scheme.system", icon: Monitor },
] as const;

export function SchemeSelector() {
  const { t } = useTranslation("theme");
  const { theme, setTheme } = useTheme();
  const current = theme ?? "system";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold tracking-tight">{t("scheme.title")}</h3>
        <span className="text-xs text-muted-foreground">{t("scheme.summary")}</span>
      </div>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label={t("scheme.title")}
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
              className={`group flex flex-col gap-2.5 rounded-selector border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                selected
                  ? "border-primary bg-card shadow-sm ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
              }`}
            >
              <SchemePreview scheme={opt.value} />
              <span className="flex items-center justify-between gap-2 px-0.5">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-base font-medium text-foreground">
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(opt.labelKey)}</span>
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
        })}
      </div>
    </div>
  );
}

function SchemePreview({ scheme }: { scheme: string }) {
  const palette = usePaletteOptional();
  const meta = getThemeMeta(palette?.theme ?? "default");
  const { light, dark, accentLight, accentDark } = meta.preview;

  if (scheme === "system") {
    return (
      <SystemSchemePreview
        light={light}
        dark={dark}
        accentLight={accentLight}
        accentDark={accentDark}
      />
    );
  }

  const isDark = scheme === "dark";
  return (
    <SingleSchemePreview
      scheme={scheme}
      bg={isDark ? dark : light}
      accent={isDark ? accentDark : accentLight}
      mixTarget={isDark ? "white" : "black"}
      isDark={isDark}
    />
  );
}

function SystemSchemePreview({
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
    <div className="relative h-20 w-full overflow-hidden rounded-xl border border-border/80 shadow-xs">
      <div className="absolute inset-0 flex">
        <SchemeHalfPane bg={light} accent={accentLight} mixTarget="black" accentPercent="25%" />
        <SchemeHalfPane bg={dark} accent={accentDark} mixTarget="white" accentPercent="35%" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-black/15 dark:bg-white/15" />
    </div>
  );
}

function SingleSchemePreview({
  scheme,
  bg,
  accent,
  mixTarget,
  isDark,
}: {
  scheme: string;
  bg: string;
  accent: string;
  mixTarget: "black" | "white";
  isDark: boolean;
}) {
  return (
    <div
      className="relative h-20 w-full overflow-hidden rounded-xl border border-border/80 p-2 shadow-xs bg-(--scheme-bg)"
      data-scheme-preview={scheme}
      style={{ "--scheme-bg": bg } as React.CSSProperties}
    >
      <div className="mb-1.5 flex gap-1">
        <div
          className="h-1.5 w-8 rounded-full bg-(--scheme-accent)"
          style={
            { "--scheme-accent": `color-mix(in oklch, ${bg}, ${accent} ${isDark ? "35%" : "25%"})` } as React.CSSProperties
          }
        />
        <div
          className="h-1.5 flex-1 rounded-full bg-(--scheme-mix)"
          style={
            { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "10%" : "6%"})` } as React.CSSProperties
          }
        />
      </div>
      <div className="flex flex-1 gap-1.5 h-12">
        <div
          className="w-7 rounded-md border bg-(--scheme-bg) border-(--scheme-border)"
          style={
            {
              "--scheme-bg": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "6%" : "4%"})`,
              "--scheme-border": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "10%"})`,
            } as React.CSSProperties
          }
        />
        <div className="flex flex-1 flex-col gap-1">
          <div
            className="h-2 rounded bg-(--scheme-mix)"
            style={
              { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "8%"})` } as React.CSSProperties
            }
          />
          <div
            className="h-2 w-3/4 rounded bg-(--scheme-mix)"
            style={
              { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "8%"})` } as React.CSSProperties
            }
          />
          <div
            className="mt-1 h-2 w-5/6 rounded bg-(--scheme-soft)"
            style={
              { "--scheme-soft": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "8%" : "5%"})` } as React.CSSProperties
            }
          />
        </div>
        <div
          className="hidden w-10 rounded-md border sm:block bg-(--scheme-bg) border-(--scheme-border)"
          style={
            {
              "--scheme-bg": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "6%" : "4%"})`,
              "--scheme-border": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "10%"})`,
            } as React.CSSProperties
          }
        />
      </div>
      <div className="mt-1.5 flex justify-center">
        <div
          className="h-2 w-16 rounded-full bg-(--scheme-mix)"
          style={
            { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "8%"})` } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}

interface SchemeHalfPaneProps {
  bg: string;
  accent: string;
  mixTarget: "black" | "white";
  accentPercent: string;
}

function SchemeHalfPane({ bg, accent, mixTarget, accentPercent }: SchemeHalfPaneProps) {
  const isWhite = mixTarget === "white";
  return (
    <div className="flex flex-1 flex-col p-2 bg-(--scheme-bg)" style={{ "--scheme-bg": bg } as React.CSSProperties}>
      <div className="mb-1.5 flex gap-1">
        <div
          className="h-1.5 w-8 rounded-full bg-(--scheme-accent)"
          style={{ "--scheme-accent": `color-mix(in oklch, ${bg}, ${accent} ${accentPercent})` } as React.CSSProperties}
        />
        <div
          className="h-1.5 flex-1 rounded-full bg-(--scheme-mix)"
          style={
            { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isWhite ? "10%" : "6%"})` } as React.CSSProperties
          }
        />
      </div>
      <div className="flex flex-1 gap-1.5 h-12">
        <div
          className="w-6 rounded-md border bg-(--scheme-bg) border-(--scheme-border)"
          style={
            {
              "--scheme-bg": `color-mix(in oklch, ${bg}, ${mixTarget} ${isWhite ? "6%" : "4%"})`,
              "--scheme-border": `color-mix(in oklch, ${bg}, ${mixTarget} ${isWhite ? "12%" : "10%"})`,
            } as React.CSSProperties
          }
        />
        <div className="flex flex-1 flex-col gap-1">
          <div
            className="h-2 rounded bg-(--scheme-mix)"
            style={
              { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isWhite ? "12%" : "8%"})` } as React.CSSProperties
            }
          />
          <div
            className="h-2 w-3/4 rounded bg-(--scheme-mix)"
            style={
              { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isWhite ? "12%" : "8%"})` } as React.CSSProperties
            }
          />
        </div>
      </div>
      <div className="mt-1.5 flex justify-center">
        <div
          className="h-1.5 w-16 rounded-full bg-(--scheme-mix)"
          style={
            { "--scheme-mix": `color-mix(in oklch, ${bg}, ${mixTarget} ${isWhite ? "12%" : "8%"})` } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}
