export type SlidesThemeOption =
  | "dark"
  | "light"
  | "accent"
  | "editorial"
  | "academic"
  | "technical"
  | "warm";

export type DetailLevel = "basic" | "detailed";

export const SLIDE_PRESETS = [5, 8, 10, 12];
export const MAX_SLIDE_COUNT = 20;

export function normalizeTheme(
  theme: SlidesThemeOption | undefined,
): Exclude<SlidesThemeOption, "accent"> {
  if (theme === "accent") return "warm";
  return theme ?? "dark";
}

export const THEME_OPTIONS = [
  {
    id: "dark" as const,
    title: "Dark",
    desc: "Slate deck, cyan accent",
    swatch: { bg: "#0F172A", surface: "#1E293B", accent: "#38BDF8", text: "#F8FAFC" },
  },
  {
    id: "light" as const,
    title: "Light",
    desc: "Bright, print-friendly",
    swatch: { bg: "#FFFFFF", surface: "#F1F5F9", accent: "#0EA5E9", text: "#0F172A" },
  },
  {
    id: "editorial" as const,
    title: "Editorial",
    desc: "Warm paper, serif voice",
    swatch: { bg: "#FDFBF7", surface: "#F5EFE6", accent: "#B45309", text: "#1C1917" },
  },
  {
    id: "academic" as const,
    title: "Academic",
    desc: "Classic lecture style",
    swatch: { bg: "#FFFFFF", surface: "#EFF6FF", accent: "#1D4ED8", text: "#111827" },
  },
  {
    id: "technical" as const,
    title: "Technical",
    desc: "Deep navy, neon detail",
    swatch: { bg: "#020617", surface: "#0F172A", accent: "#22D3EE", text: "#E2E8F0" },
  },
  {
    id: "warm" as const,
    title: "Warm",
    desc: "Bold ember energy",
    swatch: { bg: "#FFF7ED", surface: "#FFEDD5", accent: "#EA580C", text: "#431407" },
  },
] as const;

export const DETAIL_OPTIONS = [
  { id: "basic" as DetailLevel, title: "Basic", desc: "Concise bullets" },
  { id: "detailed" as DetailLevel, title: "Detailed", desc: "Rich bullets + body" },
] as const;
