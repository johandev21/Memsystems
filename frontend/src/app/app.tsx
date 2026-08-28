import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/app/router/router";
import { AppProviders } from "@/app/providers";
import { authClient } from "@/features/auth";

function AppRouter() {
  const { data: sessionData, isPending } = authClient.useSession();
  const user = sessionData?.user ?? null;
  const session = sessionData?.session ?? null;

  return (
    <RouterProvider
      router={router}
      context={{
        auth: {
          session,
          user,
          isPending,
        },
      }}
    />
  );
}

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;
