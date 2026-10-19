import "@/shared/i18n/i18n";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaletteProvider>{ui}</PaletteProvider>
    </QueryClientProvider>,
  );
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

  it("renders mobile settings header", () => {
    renderWithProviders(<MobileSettingsView />);

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

  it("renders trash card and opens trash modal on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileSettingsView />);

    expect(screen.getByRole("heading", { name: "Trash" })).toBeDefined();

    const trashButton = screen.getByRole("button", { name: "Open Trash" });
    expect(trashButton).toBeDefined();

    await user.click(trashButton);

    expect(await screen.findByPlaceholderText("Search deleted items...")).toBeDefined();
  });
});
