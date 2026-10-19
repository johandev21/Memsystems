import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { NotebookHeader } from "./notebook-header";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ state: { location: { pathname: "/" } } }),
}));

vi.mock("./editable-notebook-title", () => ({
  EditableNotebookTitle: () => <span>Notebook Title</span>,
}));

vi.mock("./mobile-notebook-menu-drawer", () => ({
  MobileNotebookMenuDrawer: () => <div data-testid="mobile-menu" />,
}));

vi.mock("@/components/layout", () => ({
  Logo: () => <div>Logo</div>,
  SettingsLink: () => <div data-testid="settings-link">SettingsLink</div>,
}));

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("NotebookHeader", () => {
  beforeEach(async () => {
    await i18n.loadNamespaces(["notebooks"]);
  });

  it("renders notebook title and settings link without the export button", () => {
    render(<NotebookHeader id="nb-test" />, { wrapper: wrapper() });

    expect(screen.getByText("Notebook Title")).toBeDefined();
    expect(screen.getByTestId("settings-link")).toBeDefined();
    expect(screen.queryByRole("button", { name: /export notebook/i })).toBeNull();
  });
});
