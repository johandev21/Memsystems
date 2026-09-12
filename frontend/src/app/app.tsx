import { Suspense } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "@/app/router/router";
import { AppProviders } from "@/app/providers";

function AppRouter() {
  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <Suspense fallback={null}>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </Suspense>
  );
}

export default App;
