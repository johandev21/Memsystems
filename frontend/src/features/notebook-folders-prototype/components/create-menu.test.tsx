import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateMenu } from "./create-menu";

describe("CreateMenu", () => {
  it("creates a notebook from the menu", async () => {
    const user = userEvent.setup();
    const onCreateNotebook = vi.fn();
    const onCreateFolder = vi.fn();
    render(<CreateMenu onCreateNotebook={onCreateNotebook} onCreateFolder={onCreateFolder} />);
    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(await screen.findByRole("menuitem", { name: /Notebook/ }));
    expect(onCreateNotebook).toHaveBeenCalledTimes(1);
    expect(onCreateFolder).not.toHaveBeenCalled();
  });

  it("creates a folder from the menu", async () => {
    const user = userEvent.setup();
    const onCreateNotebook = vi.fn();
    const onCreateFolder = vi.fn();
    render(<CreateMenu onCreateNotebook={onCreateNotebook} onCreateFolder={onCreateFolder} />);
    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.click(await screen.findByRole("menuitem", { name: /Folder/ }));
    expect(onCreateFolder).toHaveBeenCalledTimes(1);
    expect(onCreateNotebook).not.toHaveBeenCalled();
  });
});
