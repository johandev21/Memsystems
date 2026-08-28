import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { PaletteProvider } from "@/features/theme";
import { useThemeKeyboardShortcut } from "./use-theme-keyboard-shortcut";

function ThemeShortcutListener() {
  useThemeKeyboardShortcut();
  return null;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <PaletteProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        storageKey="memsystems-scheme"
      >
        <ThemeShortcutListener />
        {children}
      </NextThemesProvider>
    </PaletteProvider>
  );
}
