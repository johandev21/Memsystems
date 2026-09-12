import { createContext } from "react";
import { THEMES, type ThemeName } from "../utils/themes";

export interface PaletteContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: typeof THEMES;
  isHydrated: boolean;
}

export const PaletteContext = createContext<PaletteContextValue | null>(null);
