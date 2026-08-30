import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/app/router/router";
import { AppProviders } from "@/app/providers";
import { useAuth } from "@/shared/auth";

function AppRouter() {
  const auth = useAuth();

  return (
    <RouterProvider
      router={router}
      context={{
        auth,
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

