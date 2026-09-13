import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import notebooksEn from "@/shared/i18n/locales/en/notebooks.json";
import { CreateMenu } from "./create-menu";

// The notebooks namespace loads lazily; register the bundle directly so the
// first render cannot race the namespace fetch.
beforeAll(() => {
  i18n.addResourceBundle("en", "notebooks", notebooksEn, true, true);
});

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
