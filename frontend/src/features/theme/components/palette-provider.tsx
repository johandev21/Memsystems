import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isThemeName, THEME_STORAGE_KEY, THEMES, type ThemeName } from "../utils/themes";

export interface PaletteContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: typeof THEMES;
  isHydrated: boolean;
}

export const PaletteContext = createContext<PaletteContextValue | null>(null);

function getInitialTheme(): ThemeName {
  if (typeof window === "undefined") return "default";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isThemeName(stored)) return stored;
  } catch {
    // ignore
  }
  return "default";
}

function applyThemeAttribute(theme: ThemeName) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (theme === "default") {
    el.removeAttribute("data-theme");
  } else {
    el.setAttribute("data-theme", theme);
  }
}

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => getInitialTheme());
  const [isHydrated, setIsHydrated] = useState(false);

  // Sync attribute on mount + theme change
  useEffect(() => {
    applyThemeAttribute(theme);
    setIsHydrated(true);
  }, [theme]);

  // Listen for cross-tab changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) {
        if (e.newValue && isThemeName(e.newValue)) {
          setThemeState(e.newValue);
          applyThemeAttribute(e.newValue);
        } else if (e.newValue === null) {
          setThemeState("default");
          applyThemeAttribute("default");
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    if (!isThemeName(next)) return;
    setThemeState(next);
    try {
      if (next === "default") {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // ignore
    }
    applyThemeAttribute(next);
  }, []);

  const value = useMemo<PaletteContextValue>(
    () => ({
      theme,
      setTheme,
      themes: THEMES,
      isHydrated,
    }),
    [theme, setTheme, isHydrated],
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}
