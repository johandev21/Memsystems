import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrashLedgerView } from "./trash-ledger-view";
import * as trashApi from "../api/trash";

describe("TrashLedgerView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it("renders empty state when trash has no items", async () => {
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderWithClient(<TrashLedgerView />);

    expect(await screen.findByText("Trash is empty")).toBeTruthy();
    expect(screen.getByText("Trash")).toBeTruthy();
  });

  it("renders pure ledger sections with expiring items and tabular countdowns", async () => {
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [
        {
          id: "t-1",
          name: "Urgent Document",
          kind: "source",
          subtypeLabel: "PDF",
          daysRemaining: 3,
          deletedAt: new Date().toISOString(),
        },
        {
          id: "t-2",
          name: "Recent Folder",
          kind: "notebook_folder",
          subtypeLabel: "Folder",
          daysRemaining: 25,
          deletedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });

    renderWithClient(<TrashLedgerView />);

    expect(await screen.findByText("Urgent Document")).toBeTruthy();
    expect(screen.getByText("Recent Folder")).toBeTruthy();
    expect(screen.getByText("Expiring Within 7 Days")).toBeTruthy();
    expect(screen.getByText("Recently Deleted")).toBeTruthy();
    expect(screen.getByText("3d left")).toBeTruthy();
    expect(screen.getByText("25d left")).toBeTruthy();
    expect(screen.getByText("PDF")).toBeTruthy();
  });
});
