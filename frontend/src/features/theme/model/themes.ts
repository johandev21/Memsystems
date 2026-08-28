export const THEME_STORAGE_KEY = "memsystems-theme";

export const THEME_NAMES = ["default", "tide", "grove", "dune", "ember", "plum"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export interface ThemeMeta {
  id: ThemeName;
  label: string;
  description: string;
  /** Hue family for preview gradient generation */
  hue: number;
  /** Light mode preview accents */
  preview: {
    light: string;
    dark: string;
    accentLight: string;
    accentDark: string;
  };
}

export const THEMES: readonly ThemeMeta[] = [
  {
    id: "default",
    label: "Default",
    description: "Neutral — what you see today",
    hue: 0,
    preview: {
      light: "oklch(0.985 0 0)",
      dark: "oklch(0.17 0 0)",
      accentLight: "oklch(0.205 0 0)",
      accentDark: "oklch(0.922 0 0)",
    },
  },
  {
    id: "tide",
    label: "Tide",
    description: "Cool slate, calm and focused",
    hue: 260,
    preview: {
      light: "oklch(0.984 0.008 260)",
      dark: "oklch(0.17 0.018 260)",
      accentLight: "oklch(0.42 0.13 255)",
      accentDark: "oklch(0.78 0.08 255)",
    },
  },
  {
    id: "grove",
    label: "Grove",
    description: "Sage moss, warm and grounded",
    hue: 145,
    preview: {
      light: "oklch(0.986 0.009 145)",
      dark: "oklch(0.17 0.018 145)",
      accentLight: "oklch(0.38 0.09 148)",
      accentDark: "oklch(0.72 0.09 150)",
    },
  },
  {
    id: "dune",
    label: "Dune",
    description: "Warm sand, soft and inviting",
    hue: 75,
    preview: {
      light: "oklch(0.985 0.01 75)",
      dark: "oklch(0.18 0.018 65)",
      accentLight: "oklch(0.44 0.10 55)",
      accentDark: "oklch(0.74 0.09 60)",
    },
  },
  {
    id: "ember",
    label: "Ember",
    description: "Burnished terracotta, confident",
    hue: 30,
    preview: {
      light: "oklch(0.985 0.008 35)",
      dark: "oklch(0.17 0.018 30)",
      accentLight: "oklch(0.48 0.14 30)",
      accentDark: "oklch(0.72 0.12 30)",
    },
  },
  {
    id: "plum",
    label: "Plum",
    description: "Dusted violet, focused evening",
    hue: 300,
    preview: {
      light: "oklch(0.985 0.009 300)",
      dark: "oklch(0.17 0.019 300)",
      accentLight: "oklch(0.44 0.14 298)",
      accentDark: "oklch(0.70 0.12 298)",
    },
  },
] as const;

export function isThemeName(value: string): value is ThemeName {
  return (THEME_NAMES as readonly string[]).includes(value);
}

export function getThemeMeta(id: ThemeName): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
