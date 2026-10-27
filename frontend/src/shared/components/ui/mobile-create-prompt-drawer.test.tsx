import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MobileCreatePromptDrawer } from "./mobile-create-prompt-drawer";

describe("MobileCreatePromptDrawer", () => {
  it("renders with title, input, and actions when open", () => {
    render(
      <MobileCreatePromptDrawer
        open={true}
        onOpenChange={vi.fn()}
        title="New Folder"
        placeholder="Folder name"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "New Folder" })).toBeDefined();
    expect(screen.getByPlaceholderText("Folder name")).toBeDefined();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
    const disabledBtn = screen.getByRole("button", { name: /create/i }) as HTMLButtonElement;
    expect(disabledBtn.disabled).toBe(true);
  });

  it("enables create button when text is entered and calls onConfirm with trimmed name", async () => {
    const handleConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <MobileCreatePromptDrawer
        open={true}
        onOpenChange={vi.fn()}
        title="New Folder"
        placeholder="Folder name"
        onConfirm={handleConfirm}
      />
    );

    const input = screen.getByPlaceholderText("Folder name");
    await user.type(input, "  My Project  ");

    const createBtn = screen.getByRole("button", { name: /create/i }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);

    await user.click(createBtn);
    expect(handleConfirm).toHaveBeenCalledWith("My Project");
  });

  it("calls onOpenChange(false) when cancel button is clicked", async () => {
    const handleOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MobileCreatePromptDrawer
        open={true}
        onOpenChange={handleOpenChange}
        title="New Folder"
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits the form when Enter is pressed in the input", async () => {
    const handleConfirm = vi.fn();

    render(
      <MobileCreatePromptDrawer
        open={true}
        onOpenChange={vi.fn()}
        title="New Folder"
        placeholder="Folder name"
        onConfirm={handleConfirm}
      />,
    );

    const input = screen.getByPlaceholderText("Folder name");
    fireEvent.change(input, { target: { value: "Fast Folder" } });
    fireEvent.submit(input.closest("form")!);

    expect(handleConfirm).toHaveBeenCalledWith("Fast Folder");
  });
});
