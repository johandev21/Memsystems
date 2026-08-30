import { ClerkLoaded, ClerkLoading, SignIn } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-0 p-4">
      <div className="w-full max-w-md flex justify-center min-h-[460px]">
        <ClerkLoading>
          <div className="w-full rounded-2xl border border-surface-border bg-surface-1 p-8 space-y-6 shadow-xs">
            <div className="space-y-2 text-center">
              <Skeleton className="h-6 w-32 mx-auto" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </ClerkLoading>
        <ClerkLoaded>
          <SignIn
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full shadow-none",
              },
            }}
          />
        </ClerkLoaded>
      </div>
    </main>
  );
}
