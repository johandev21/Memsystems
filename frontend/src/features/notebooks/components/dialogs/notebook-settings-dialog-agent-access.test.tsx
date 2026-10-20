import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { NotebookSettingsDialog } from "./notebook-settings-dialog";

function notebook(agentAccessOverride: "on" | "read_only" | "off" | null) {
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
    groundingMode: "strict",
    agentAccess: agentAccessOverride ?? "on",
    agentAccessOverride,
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

describe("NotebookSettingsDialog agent access", () => {
  let override: "on" | "read_only" | "off" | null = null;
  let patched: unknown = null;

  beforeEach(async () => {
    await i18n.loadNamespaces(["notebooks"]);
    await i18n.changeLanguage("en");
    override = null;
    patched = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patched = JSON.parse(String(init.body));
          override = (patched as { agentAccess: typeof override }).agentAccess;
          return Response.json(notebook(override));
        }
        return Response.json(notebook(override));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the resolved level and persists an override", async () => {
    const user = userEvent.setup();
    render(<NotebookSettingsDialog notebookId="nb-1" />, { wrapper: wrapper() });

    await user.click(screen.getByRole("button", { name: "Notebook settings" }));

    const trigger = await screen.findByRole("menuitem", { name: /agent access/i });
    expect(trigger.textContent).toContain("On");

    fireEvent.pointerEnter(trigger);
    fireEvent.click(trigger);

    const inheritRadio = await screen.findByRole("menuitemradio", { name: /inherit/i });
    expect(inheritRadio.getAttribute("aria-checked")).toBe("true");

    const readOnlyRadio = await screen.findByRole("menuitemradio", { name: /read-only/i });
    fireEvent.click(readOnlyRadio);

    await waitFor(() => {
      expect(patched).toEqual({ agentAccess: "read_only" });
    });
    await waitFor(() => {
      expect(readOnlyRadio.getAttribute("aria-checked")).toBe("true");
    });
  });
});
