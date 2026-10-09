import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClearHistoryDialog } from "./clear-history-dialog";

describe("ClearHistoryDialog", () => {
  it("renders mobile drawer when screen width is under 640px", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    // Default window.matchMedia returns matches: false (mobile)
    render(
      <ClearHistoryDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isClearing={false}
      />,
    );

    expect(screen.getByRole("heading", { name: "Clear Chat History" })).toBeTruthy();
    expect(screen.getByText("Are you sure you want to clear all chat messages in this notebook?")).toBeTruthy();

    const confirmBtn = screen.getByRole("button", { name: "Clear History" });
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn.className).toContain("min-h-11");
    expect(confirmBtn.className).toContain("touch-manipulation");

    await user.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders desktop alert dialog when screen width is at least 640px", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(min-width: 640px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

    render(
      <ClearHistoryDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isClearing={false}
      />,
    );

    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("Clear Chat History")).toBeTruthy();

    const confirmBtn = screen.getByRole("button", { name: "Clear History" });
    await user.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables buttons when isClearing is true", () => {
    render(
      <ClearHistoryDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isClearing={true}
      />,
    );

    const clearingBtn = screen.getByRole("button", { name: "Clearing..." });
    expect((clearingBtn as HTMLButtonElement).disabled).toBe(true);

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
