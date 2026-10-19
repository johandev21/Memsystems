import "@/shared/i18n/i18n";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrashCard } from "./trash-card";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("TrashCard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.loadNamespaces(["settings"]);
    await i18n.changeLanguage("en");
  });

  afterEach(cleanup);

  it("renders trash card with action and title", () => {
    renderWithClient(<TrashCard />);

    expect(screen.getByRole("button", { name: "Open Trash" })).toBeDefined();
    expect(screen.getByText("Trash")).toBeDefined();
    expect(screen.getByText("View, restore, or permanently delete items.")).toBeDefined();
  });

  it("opens trash modal combobox when clicked", async () => {
    const user = userEvent.setup();
    renderWithClient(<TrashCard />);

    const button = screen.getByRole("button", { name: "Open Trash" });
    await user.click(button);

    expect(await screen.findByPlaceholderText("Search deleted items...")).toBeDefined();
  });
});
