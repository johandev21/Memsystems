export type SlidesThemeOption =
  | "dark"
  | "light"
  | "accent"
  | "editorial"
  | "academic"
  | "technical"
  | "warm"
  | "auto";

export type DetailLevel = "basic" | "detailed";
export type SlidesDetailLevel = DetailLevel | "auto";

export const SLIDE_PRESETS = [5, 8, 10];
export const MAX_SLIDE_COUNT = 20;

export function normalizeTheme(
  theme: SlidesThemeOption | undefined,
): Exclude<SlidesThemeOption, "accent"> {
  if (theme === "accent") return "warm";
  return theme ?? "auto";
}

export const THEME_OPTIONS = [
  {
    id: "dark" as const,
    titleKey: "slides.themes.dark.title",
    descKey: "slides.themes.dark.desc",
    swatch: { bg: "#0F172A", surface: "#1E293B", accent: "#38BDF8", text: "#F8FAFC" },
  },
  {
    id: "light" as const,
    titleKey: "slides.themes.light.title",
    descKey: "slides.themes.light.desc",
    swatch: { bg: "#FFFFFF", surface: "#F1F5F9", accent: "#0EA5E9", text: "#0F172A" },
  },
  {
    id: "editorial" as const,
    titleKey: "slides.themes.editorial.title",
    descKey: "slides.themes.editorial.desc",
    swatch: { bg: "#FDFBF7", surface: "#F5EFE6", accent: "#B45309", text: "#1C1917" },
  },
  {
    id: "academic" as const,
    titleKey: "slides.themes.academic.title",
    descKey: "slides.themes.academic.desc",
    swatch: { bg: "#FFFFFF", surface: "#EFF6FF", accent: "#1D4ED8", text: "#111827" },
  },
  {
    id: "technical" as const,
    titleKey: "slides.themes.technical.title",
    descKey: "slides.themes.technical.desc",
    swatch: { bg: "#020617", surface: "#0F172A", accent: "#22D3EE", text: "#E2E8F0" },
  },
  {
    id: "warm" as const,
    titleKey: "slides.themes.warm.title",
    descKey: "slides.themes.warm.desc",
    swatch: { bg: "#FFF7ED", surface: "#FFEDD5", accent: "#EA580C", text: "#431407" },
  },
] as const;

export const DETAIL_OPTIONS = [
  {
    id: "basic" as DetailLevel,
    titleKey: "slides.detail.basic.title",
    descKey: "slides.detail.basic.desc",
  },
  {
    id: "detailed" as DetailLevel,
    titleKey: "slides.detail.detailed.title",
    descKey: "slides.detail.detailed.desc",
  },
] as const;

export const DEFAULT_SLIDES_OPTIONS: {
  slideCount: number;
  theme: Exclude<SlidesThemeOption, "accent">;
  detailLevel: SlidesDetailLevel;
} = {
  slideCount: 0,
  theme: "auto",
  detailLevel: "auto",
};
