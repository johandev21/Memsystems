import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/react";
import { shadcn } from "@clerk/ui/themes";
import { Toaster } from "sonner";
import { router } from "@/app/router/router";
import { QueryProvider } from "./query-provider";
import { AppThemeProvider } from "./theme-provider";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function AppProviders({ children }: { children: ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in frontend environment");
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      signInUrl="/login"
      signInFallbackRedirectUrl="/home"
      signUpFallbackRedirectUrl="/home"
      routerPush={(to) => router.navigate({ to })}
      routerReplace={(to) => router.navigate({ to, replace: true })}
      appearance={{ theme: shadcn }}
    >
      <QueryProvider>
        <AppThemeProvider>
          {children}
          <Toaster position="top-right" />
        </AppThemeProvider>
      </QueryProvider>
    </ClerkProvider>
  );
}

export * from "./query-provider";
export * from "./theme-provider";
export * from "./use-theme-keyboard-shortcut";
