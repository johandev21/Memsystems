import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GatewayCard } from "./gateway-card";

const status = vi.hoisted(() => ({ pending: false, connected: false, degraded: false }));
vi.mock("@/features/ai", () => ({
  useConnectionStatus: () => ({
    isPending: status.pending,
    data: { ok: status.connected, degraded: status.degraded, models: [], gateway: { hasKey: false } },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("./gateway-key-form", () => ({ GatewayKeyForm: () => null }));

afterEach(cleanup);

it.each([
  [true, false, false, "Checking"],
  [false, true, false, "Connected"],
  [false, false, true, "Degraded"],
  [false, false, false, "Not connected"],
] as const)("keeps status readable without icons: %s/%s/%s", (pending, connected, degraded, label) => {
  Object.assign(status, { pending, connected, degraded });
  render(<GatewayCard />);
  const badge = screen.getByText(label);
  expect(badge.children).toHaveLength(0);
  expect(screen.getByRole("heading", { name: "AI Gateway" })).toBeTruthy();
});
