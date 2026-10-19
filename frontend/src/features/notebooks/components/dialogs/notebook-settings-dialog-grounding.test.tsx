import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { NotebookSettingsDialog } from "./notebook-settings-dialog";
import * as notebookApi from "../../api/notebooks";

function notebook(groundingMode?: string) {
  return {
    id: "nb-1",
    title: "Notebook",
    description: "",
    icon: "notebook",
    folderId: null,
    banner: null,
    bannerUrl: null,
    bannerVariants: null,
    bannerFocalPoint: null,
    ...(groundingMode === undefined ? {} : { groundingMode }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("NotebookSettingsDialog grounding mode", () => {
  let mode = "strict";
  let patched: unknown = null;

  beforeEach(async () => {
    await i18n.loadNamespaces(["notebooks"]);
    await i18n.changeLanguage("en");
    mode = "strict";
    patched = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patched = JSON.parse(String(init.body));
          mode = (patched as { groundingMode: string }).groundingMode;
          return Response.json(notebook(mode));
        }
        return Response.json(notebook(mode));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the current mode and persists a change", async () => {
    const user = userEvent.setup();
    render(<NotebookSettingsDialog notebookId="nb-1" />, { wrapper: wrapper() });

    await user.click(screen.getByRole("button", { name: "Notebook settings" }));

    // Verify trigger displays current mode
    const groundingTrigger = await screen.findByRole("menuitem", { name: /grounding mode/i });
    expect(groundingTrigger.textContent).toContain("Strict");

    // Open submenu
    fireEvent.pointerEnter(groundingTrigger);
    fireEvent.click(groundingTrigger);

    const strictRadio = await screen.findByRole("menuitemradio", { name: /strict/i });
    expect(strictRadio.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Answers only from sources")).toBeDefined();
    expect(screen.getByText("Sources first, then labeled general knowledge")).toBeDefined();
    expect(screen.getByText("Answers freely, using sources only when relevant")).toBeDefined();

    const freeRadio = await screen.findByRole("menuitemradio", { name: /free/i });
    fireEvent.click(freeRadio);

    await waitFor(() => {
      expect(patched).toEqual({ groundingMode: "free" });
    });
    await waitFor(() => {
      expect(freeRadio.getAttribute("aria-checked")).toBe("true");
    });
  });

  it("renders export notebook menu item and calls exportNotebook on click", async () => {
    const user = userEvent.setup();
    const exportSpy = vi.spyOn(notebookApi, "exportNotebook").mockResolvedValue();

    render(<NotebookSettingsDialog notebookId="nb-1" />, { wrapper: wrapper() });

    await user.click(screen.getByRole("button", { name: "Notebook settings" }));
    const exportItem = await screen.findByRole("menuitem", { name: /export notebook/i });
    expect(exportItem).toBeDefined();

    await user.click(exportItem);

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledWith("nb-1", "Notebook");
    });
  });
});
