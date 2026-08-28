import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "./query-provider";
import { AppThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AppThemeProvider>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </AppThemeProvider>
    </QueryProvider>
  );
}

export * from "./query-provider";
export * from "./auth-provider";
export * from "./theme-provider";
export * from "./use-theme-keyboard-shortcut";
