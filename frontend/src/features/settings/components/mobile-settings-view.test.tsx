import "@/shared/i18n/i18n";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaletteProvider } from "@/features/theme/components/palette-provider";
import { MobileSettingsView } from "./mobile-settings-view";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "system",
    resolvedTheme: "light",
    setTheme: mockSetTheme,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function renderWithProviders(ui: ReactNode) {
  return render(<PaletteProvider>{ui}</PaletteProvider>);
}

describe("MobileSettingsView", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    await i18n.loadNamespaces(["settings", "theme"]);
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  it("renders mobile settings header with back navigation to root", () => {
    renderWithProviders(<MobileSettingsView />);

    const backLink = screen.getByRole("link", { name: "Library" });
    expect(backLink).toBeDefined();
    expect(backLink.getAttribute("href")).toBe("/");

    expect(screen.getByRole("heading", { name: "Settings" })).toBeDefined();
  });

  it("renders color scheme segmented control and allows switching scheme", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileSettingsView />);

    const darkOption = screen.getByRole("radio", { name: "Dark" });
    expect(darkOption).toBeDefined();

    await user.click(darkOption);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("renders compact theme grid with all themes and allows switching palette", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileSettingsView />);

    const kanagawaOption = screen.getByRole("radio", { name: /Kanagawa/i });
    expect(kanagawaOption).toBeDefined();

    await user.click(kanagawaOption);
    expect(window.localStorage.getItem("memsystems-theme")).toBe("kanagawa");
    expect(document.documentElement.getAttribute("data-theme")).toBe("kanagawa");
  });

  it("renders compact language selector and allows switching language", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileSettingsView />);

    const esOption = screen.getByRole("radio", { name: "Español" });
    expect(esOption).toBeDefined();

    await user.click(esOption);
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("es");
    });
  });
});
