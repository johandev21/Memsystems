import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { NotebookSettingsDialog } from "./notebook-settings-dialog";

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
    expect(
      screen.getByRole("button", { name: "Strict" }).getAttribute("aria-pressed"),
    ).toBe("true");

    await user.click(screen.getByRole("button", { name: "Free" }));
    await waitFor(() => {
      expect(patched).toEqual({ groundingMode: "free" });
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Free" }).getAttribute("aria-pressed"),
      ).toBe("true");
    });
  });
});
