import { Outlet } from "@tanstack/react-router";
import { RouteProgressBar } from "@/components/feedback";

export function RootLayout() {
  return (
    <>
      <RouteProgressBar />
      <Outlet />
    </>
  );
}
