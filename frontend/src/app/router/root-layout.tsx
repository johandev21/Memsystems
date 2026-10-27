import { Outlet } from "@tanstack/react-router";
import { RouteProgressBar } from "./route-progress-bar";

export function RootLayout() {
  return (
    <>
      <RouteProgressBar />
      <Outlet />
    </>
  );
}
