import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { MobileCreateDrawer } from "./mobile-create-drawer";

describe("MobileCreateDrawer", () => {
  beforeEach(async () => {
    await i18n.loadNamespaces(["notebooks"]);
    await i18n.changeLanguage("en");
  });

  it("renders clean drawer options with unboxed action rows and no card wrappers", () => {
    const handleOpenChange = vi.fn();
    const handleCreateNotebook = vi.fn();
    const handleCreateFolder = vi.fn();

    const { container } = render(
      <MobileCreateDrawer
        isOpen={true}
        onOpenChange={handleOpenChange}
        onCreateNotebook={handleCreateNotebook}
        onCreateFolder={handleCreateFolder}
      />,
    );

    // Title exists
    expect(screen.getByText("Create new")).toBeDefined();

    // Notebook and folder options
    const nbOption = screen.getByRole("button", { name: /^notebook\b/i });
    const folderOption = screen.getByRole("button", { name: /^folder\b/i });
    expect(nbOption).toBeDefined();
    expect(folderOption).toBeDefined();

    // Options must NOT use card containers or card borders (no-ui-slop)
    expect(nbOption.className).not.toContain("bg-card");
    expect(nbOption.className).not.toContain("border-border");
    expect(folderOption.className).not.toContain("bg-card");
    expect(folderOption.className).not.toContain("border-border");

    // Icons must be compact and unboxed
    const icons = container.querySelectorAll("svg");
    icons.forEach((icon) => {
      expect(icon.classList.contains("size-10")).toBe(false);
    });
  });

  it("calls onCreateNotebook and closes drawer on tap", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleCreateNotebook = vi.fn();

    render(
      <MobileCreateDrawer
        isOpen={true}
        onOpenChange={handleOpenChange}
        onCreateNotebook={handleCreateNotebook}
        onCreateFolder={vi.fn()}
      />,
    );

    const nbOption = screen.getByRole("button", { name: /^notebook\b/i });
    await user.click(nbOption);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleCreateNotebook).toHaveBeenCalledTimes(1);
  });

  it("calls onCreateFolder and closes drawer on tap", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleCreateFolder = vi.fn();

    render(
      <MobileCreateDrawer
        isOpen={true}
        onOpenChange={handleOpenChange}
        onCreateNotebook={vi.fn()}
        onCreateFolder={handleCreateFolder}
      />,
    );

    const folderOption = screen.getByRole("button", { name: /^folder\b/i });
    await user.click(folderOption);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleCreateFolder).toHaveBeenCalledTimes(1);
  });

  it("calls onImportNotebook and closes drawer on tap", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleImportNotebook = vi.fn();

    render(
      <MobileCreateDrawer
        isOpen={true}
        onOpenChange={handleOpenChange}
        onCreateNotebook={vi.fn()}
        onCreateFolder={vi.fn()}
        onImportNotebook={handleImportNotebook}
      />,
    );

    const importOption = screen.getByRole("button", { name: /^import notebook\b/i });
    await user.click(importOption);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleImportNotebook).toHaveBeenCalledTimes(1);
  });
});
