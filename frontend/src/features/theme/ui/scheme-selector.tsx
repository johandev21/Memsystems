import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { getThemeMeta } from "../model/themes";
import { usePaletteOptional } from "../model/use-palette";

type SchemeOption = {
  value: string;
  label: string;
  icon: typeof Sun;
};

const SCHEME_OPTIONS: readonly SchemeOption[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function SchemePreview({ scheme }: { scheme: string }) {
  const palette = usePaletteOptional();
  const meta = getThemeMeta(palette?.theme ?? "default");
  const { light, dark, accentLight, accentDark } = meta.preview;

  if (scheme === "system") {
    return (
      <div className="relative h-20 w-full overflow-hidden rounded-xl border border-border/80 shadow-xs">
        <div className="absolute inset-0 flex">
          {/* Light side */}
          <div className="flex flex-1 flex-col p-2" style={{ backgroundColor: light }}>
            <div className="mb-1.5 flex gap-1">
              <div
                className="h-1.5 w-8 rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${light}, ${accentLight} 25%)` }}
              />
              <div
                className="h-1.5 flex-1 rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${light}, black 6%)` }}
              />
            </div>
            <div className="flex flex-1 gap-1.5" style={{ height: "48px" }}>
              <div
                className="w-6 rounded-md border"
                style={{
                  backgroundColor: `color-mix(in oklch, ${light}, black 4%)`,
                  borderColor: `color-mix(in oklch, ${light}, black 10%)`,
                }}
              />
              <div className="flex flex-1 flex-col gap-1">
                <div
                  className="h-2 rounded"
                  style={{ backgroundColor: `color-mix(in oklch, ${light}, black 8%)` }}
                />
                <div
                  className="h-2 w-3/4 rounded"
                  style={{ backgroundColor: `color-mix(in oklch, ${light}, black 8%)` }}
                />
              </div>
            </div>
            <div className="mt-1.5 flex justify-center">
              <div
                className="h-1.5 w-16 rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${light}, black 8%)` }}
              />
            </div>
          </div>

          {/* Dark side */}
          <div className="flex flex-1 flex-col p-2" style={{ backgroundColor: dark }}>
            <div className="mb-1.5 flex gap-1">
              <div
                className="h-1.5 w-8 rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${dark}, ${accentDark} 35%)` }}
              />
              <div
                className="h-1.5 flex-1 rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${dark}, white 10%)` }}
              />
            </div>
            <div className="flex flex-1 gap-1.5" style={{ height: "48px" }}>
              <div
                className="w-6 rounded-md border"
                style={{
                  backgroundColor: `color-mix(in oklch, ${dark}, white 6%)`,
                  borderColor: `color-mix(in oklch, ${dark}, white 12%)`,
                }}
              />
              <div className="flex flex-1 flex-col gap-1">
                <div
                  className="h-2 rounded"
                  style={{ backgroundColor: `color-mix(in oklch, ${dark}, white 12%)` }}
                />
                <div
                  className="h-2 w-3/4 rounded"
                  style={{ backgroundColor: `color-mix(in oklch, ${dark}, white 12%)` }}
                />
              </div>
            </div>
            <div className="mt-1.5 flex justify-center">
              <div
                className="h-1.5 w-16 rounded-full"
                style={{ backgroundColor: `color-mix(in oklch, ${dark}, white 12%)` }}
              />
            </div>
          </div>
        </div>
        {/* divider */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-black/15 dark:bg-white/15" />
      </div>
    );
  }

  const isDark = scheme === "dark";
  const bg = isDark ? dark : light;
  const accent = isDark ? accentDark : accentLight;
  const mixTarget = isDark ? "white" : "black";

  return (
    <div
      className="relative h-20 w-full overflow-hidden rounded-xl border border-border/80 p-2 shadow-xs"
      data-scheme-preview={scheme}
      style={{ backgroundColor: bg }}
    >
      <div className="mb-1.5 flex gap-1">
        <div
          className="h-1.5 w-8 rounded-full"
          style={{
            backgroundColor: `color-mix(in oklch, ${bg}, ${accent} ${isDark ? "35%" : "25%"})`,
          }}
        />
        <div
          className="h-1.5 flex-1 rounded-full"
          style={{
            backgroundColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "10%" : "6%"})`,
          }}
        />
      </div>
      <div className="flex flex-1 gap-1.5" style={{ height: "48px" }}>
        <div
          className="w-7 rounded-md border"
          style={{
            backgroundColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "6%" : "4%"})`,
            borderColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "10%"})`,
          }}
        />
        <div className="flex flex-1 flex-col gap-1">
          <div
            className="h-2 rounded"
            style={{
              backgroundColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "8%"})`,
            }}
          />
          <div
            className="h-2 w-3/4 rounded"
            style={{
              backgroundColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "8%"})`,
            }}
          />
          <div
            className="mt-1 h-2 w-5/6 rounded"
            style={{
              backgroundColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "8%" : "5%"})`,
            }}
          />
        </div>
        <div
          className="hidden w-10 rounded-md border sm:block"
          style={{
            backgroundColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "6%" : "4%"})`,
            borderColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "10%"})`,
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-center">
        <div
          className="h-2 w-16 rounded-full"
          style={{
            backgroundColor: `color-mix(in oklch, ${bg}, ${mixTarget} ${isDark ? "12%" : "8%"})`,
          }}
        />
      </div>
    </div>
  );
}

export function SchemeSelector() {
  const { theme, setTheme } = useTheme();
  const current = theme ?? "system";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">Color scheme</h3>
        <span className="text-xs text-muted-foreground">Light / Dark / System</span>
      </div>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Color scheme"
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
              className={`group flex flex-col gap-2.5 rounded-[20px] border p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                selected
                  ? "border-primary bg-card shadow-sm ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-border/80 hover:bg-muted/20"
              }`}
            >
              <SchemePreview scheme={opt.value} />
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {opt.label}
                {selected ? (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
