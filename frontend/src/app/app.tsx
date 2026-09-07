import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/app/router/router";
import { AppProviders } from "@/app/providers";

function AppRouter() {
  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

export default App;
