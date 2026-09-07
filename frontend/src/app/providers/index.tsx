import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "./query-provider";
import { AppThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AppThemeProvider>
        {children}
        <Toaster position="top-right" />
      </AppThemeProvider>
    </QueryProvider>
  );
}

export * from "./query-provider";
export * from "./theme-provider";
export * from "./use-theme-keyboard-shortcut";
