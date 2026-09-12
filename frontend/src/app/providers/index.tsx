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

export { QueryProvider } from "./query-provider";
export { AppThemeProvider } from "./theme-provider";
