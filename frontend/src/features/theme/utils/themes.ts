export const THEME_STORAGE_KEY = "memsystems-theme";

export const THEME_NAMES = [
  "default",
  "kanagawa",
  "gruvbox",
  "tokyo-night",
  "catppuccin",
  "nord",
  "everforest",
  "rose-pine",
  "matte-black",
  "matrix",
  "dracula",
  "monokai",
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export type ThemeDescriptionKey = `descriptions.${ThemeName}`;

export interface ThemeMeta {
  id: ThemeName;
  label: string;
  descriptionKey: ThemeDescriptionKey;
  /** Hue family for preview gradient generation */
  hue: number;
  /** Preview swatch accents (light-mode / dark-mode) */
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
    descriptionKey: "descriptions.default",
    hue: 0,
    preview: {
      light: "oklch(0.985 0 0)",
      dark: "oklch(0.17 0 0)",
      accentLight: "oklch(0.205 0 0)",
      accentDark: "oklch(0.922 0 0)",
    },
  },
  {
    id: "kanagawa",
    label: "Kanagawa",
    descriptionKey: "descriptions.kanagawa",
    hue: 185,
    preview: {
      light: "oklch(0.975 0.012 85)",
      dark: "oklch(0.19 0.015 265)",
      accentLight: "oklch(0.42 0.09 195)",
      accentDark: "oklch(0.78 0.08 185)",
    },
  },
  {
    id: "gruvbox",
    label: "Gruvbox",
    descriptionKey: "descriptions.gruvbox",
    hue: 55,
    preview: {
      light: "oklch(0.975 0.018 80)",
      dark: "oklch(0.22 0.015 65)",
      accentLight: "oklch(0.48 0.15 48)",
      accentDark: "oklch(0.74 0.15 55)",
    },
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    descriptionKey: "descriptions.tokyo-night",
    hue: 260,
    preview: {
      light: "oklch(0.975 0.012 265)",
      dark: "oklch(0.18 0.03 268)",
      accentLight: "oklch(0.44 0.16 260)",
      accentDark: "oklch(0.76 0.12 255)",
    },
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    descriptionKey: "descriptions.catppuccin",
    hue: 305,
    preview: {
      light: "oklch(0.975 0.01 285)",
      dark: "oklch(0.20 0.022 280)",
      accentLight: "oklch(0.46 0.16 300)",
      accentDark: "oklch(0.76 0.12 305)",
    },
  },
  {
    id: "nord",
    label: "Nord",
    descriptionKey: "descriptions.nord",
    hue: 215,
    preview: {
      light: "oklch(0.975 0.008 235)",
      dark: "oklch(0.23 0.018 245)",
      accentLight: "oklch(0.44 0.10 235)",
      accentDark: "oklch(0.76 0.08 215)",
    },
  },
  {
    id: "everforest",
    label: "Everforest",
    descriptionKey: "descriptions.everforest",
    hue: 138,
    preview: {
      light: "oklch(0.975 0.012 110)",
      dark: "oklch(0.22 0.016 145)",
      accentLight: "oklch(0.44 0.11 138)",
      accentDark: "oklch(0.75 0.10 135)",
    },
  },
  {
    id: "rose-pine",
    label: "Rosé Pine",
    descriptionKey: "descriptions.rose-pine",
    hue: 15,
    preview: {
      light: "oklch(0.975 0.008 60)",
      dark: "oklch(0.18 0.02 315)",
      accentLight: "oklch(0.48 0.15 15)",
      accentDark: "oklch(0.74 0.13 15)",
    },
  },
  {
    id: "matte-black",
    label: "Matte Black",
    descriptionKey: "descriptions.matte-black",
    hue: 0,
    preview: {
      light: "oklch(0.985 0 0)",
      dark: "oklch(0.14 0 0)",
      accentLight: "oklch(0.22 0 0)",
      accentDark: "oklch(0.88 0 0)",
    },
  },
  {
    id: "matrix",
    label: "Matrix",
    descriptionKey: "descriptions.matrix",
    hue: 145,
    preview: {
      light: "oklch(0.975 0.015 145)",
      dark: "oklch(0.14 0.02 145)",
      accentLight: "oklch(0.40 0.14 145)",
      accentDark: "oklch(0.78 0.18 145)",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    descriptionKey: "descriptions.dracula",
    hue: 295,
    preview: {
      light: "oklch(0.975 0.01 290)",
      dark: "oklch(0.20 0.025 285)",
      accentLight: "oklch(0.44 0.16 295)",
      accentDark: "oklch(0.74 0.14 295)",
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    descriptionKey: "descriptions.monokai",
    hue: 115,
    preview: {
      light: "oklch(0.975 0.012 85)",
      dark: "oklch(0.21 0.014 105)",
      accentLight: "oklch(0.44 0.12 60)",
      accentDark: "oklch(0.78 0.16 115)",
    },
  },
] as const;

export function isThemeName(value: string): value is ThemeName {
  return (THEME_NAMES as readonly string[]).includes(value);
}

export function getThemeMeta(id: ThemeName): ThemeMeta {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
