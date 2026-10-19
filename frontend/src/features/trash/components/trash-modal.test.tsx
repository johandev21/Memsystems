import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "i18next";
import { TrashModal } from "./trash-modal";
import * as trashApi from "../api/trash";

describe("TrashModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setDesktopViewport = (isDesktop: boolean) => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: isDesktop,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
  };

  const renderWithClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it("does not render dialog content when open is false", () => {
    setDesktopViewport(true);
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderWithClient(<TrashModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText("Search deleted items...")).toBeNull();
  });

  it("renders empty state when trash has no items", async () => {
    setDesktopViewport(true);
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Trash is empty")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search deleted items...")).toBeTruthy();
  });

  it("renders pure ledger groups with countdowns and kind labels", async () => {
    setDesktopViewport(true);
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

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Urgent Document")).toBeTruthy();
    expect(screen.getByText("Recent Folder")).toBeTruthy();
    expect(screen.getByText("Expiring Within 7 Days")).toBeTruthy();
    expect(screen.getByText("Recently Deleted")).toBeTruthy();
    expect(screen.getByText("3d left")).toBeTruthy();
    expect(screen.getByText("25d left")).toBeTruthy();
    expect(screen.getByText("PDF")).toBeTruthy();
  });

  it("filters items by name and subtype when typing into the search input", async () => {
    setDesktopViewport(true);
    const user = userEvent.setup();
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [
        {
          id: "t-1",
          name: "Alpha Physics Notes",
          kind: "notebook",
          subtypeLabel: "Notebook",
          daysRemaining: 2,
          deletedAt: new Date().toISOString(),
        },
        {
          id: "t-2",
          name: "Beta Chem Lab",
          kind: "source",
          subtypeLabel: "PDF",
          daysRemaining: 10,
          deletedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Alpha Physics Notes")).toBeTruthy();
    expect(screen.getByText("Beta Chem Lab")).toBeTruthy();

    const searchInput = screen.getByPlaceholderText("Search deleted items...");
    await user.type(searchInput, "physics");

    expect(screen.getByText("Alpha Physics Notes")).toBeTruthy();
    expect(screen.queryByText("Beta Chem Lab")).toBeNull();
  });

  it("calls restore API when Restore button is clicked", async () => {
    setDesktopViewport(true);
    const user = userEvent.setup();
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [
        {
          id: "item-123",
          name: "Item To Restore",
          kind: "notebook",
          subtypeLabel: "Notebook",
          daysRemaining: 15,
          deletedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });
    const restoreSpy = vi.spyOn(trashApi, "restoreTrashItem").mockResolvedValue({
      success: true,
      id: "item-123",
      kind: "notebook",
    });

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Item To Restore")).toBeTruthy();

    const restoreBtn = screen.getByRole("button", { name: "Restore" });
    await user.click(restoreBtn);

    expect(restoreSpy).toHaveBeenCalledWith("notebook", "item-123");
  });

  it("opens ConfirmDeleteDialog and calls deleteForever API upon confirmation", async () => {
    setDesktopViewport(true);
    const user = userEvent.setup();
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [
        {
          id: "item-456",
          name: "Item To Delete",
          kind: "source",
          subtypeLabel: "PDF",
          daysRemaining: 4,
          deletedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });
    const deleteSpy = vi.spyOn(trashApi, "deleteForeverTrashItem").mockResolvedValue({
      success: true,
      id: "item-456",
      kind: "source",
    });

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Item To Delete")).toBeTruthy();

    const deleteBtn = screen.getByRole("button", { name: "Delete forever" });
    await user.click(deleteBtn);

    expect(
      await screen.findByText('Permanently delete "Item To Delete"? This cannot be undone.'),
    ).toBeTruthy();

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(confirmBtn);

    expect(deleteSpy).toHaveBeenCalledWith("source", "item-456");
  });

  it("triggers empty trash action after holding for 1400ms", async () => {
    setDesktopViewport(true);
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [
        {
          id: "item-789",
          name: "Item To Empty",
          kind: "notebook",
          subtypeLabel: "Notebook",
          daysRemaining: 10,
          deletedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });
    const emptySpy = vi.spyOn(trashApi, "emptyTrashApi").mockResolvedValue({
      success: true,
      purged: true,
    });

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Item To Empty")).toBeTruthy();

    const holdBtn = screen.getByRole("button", { name: "Hold to Empty Trash" });
    expect(holdBtn.getAttribute("data-holding")).toBe("false");

    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(holdBtn);
      expect(holdBtn.getAttribute("data-holding")).toBe("true");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(emptySpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("optimistically updates and invalidates library and folder queries upon restore", async () => {
    setDesktopViewport(true);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [
        {
          id: "folder-opt-1",
          name: "Optimistic Folder",
          kind: "notebook_folder",
          subtypeLabel: "Folder",
          daysRemaining: 20,
          deletedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });
    vi.spyOn(trashApi, "restoreTrashItem").mockResolvedValue({
      success: true,
      id: "folder-opt-1",
      kind: "notebook_folder",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TrashModal open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Optimistic Folder")).toBeTruthy();

    const restoreBtn = screen.getByRole("button", { name: "Restore" });
    await user.click(restoreBtn);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["trash"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["library"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["source-folders"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["study-material-folders"] });
  });

  it("renders mobile drawer when screen width is under 640px", async () => {
    setDesktopViewport(false);
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Trash is empty")).toBeTruthy();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeTruthy();
  });

  it("renders Spanish translations when language is set to es", async () => {
    setDesktopViewport(true);
    await i18n.changeLanguage("es");
    vi.spyOn(trashApi, "fetchTrashPage").mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    renderWithClient(<TrashModal open={true} onOpenChange={vi.fn()} />);

    expect(await screen.findByText("La papelera está vacía")).toBeTruthy();
    expect(screen.getByPlaceholderText("Buscar elementos eliminados...")).toBeTruthy();
    expect(
      screen.getByText(
        "Las carpetas, cuadernos, fuentes y materiales de estudio eliminados permanecen recuperables aquí durante 30 días.",
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Los elementos se eliminan permanentemente después de 30 días.").length,
    ).toBeGreaterThanOrEqual(1);
  });
});
