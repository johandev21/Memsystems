import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import type { AgentAccessSettings } from "../api/agent-access";
import { AgentAccessCard } from "./agent-access-card";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AgentAccessCard", () => {
  let settings: AgentAccessSettings;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await i18n.loadNamespaces(["settings"]);
    await i18n.changeLanguage("en");

    settings = {
      softDelete: "ask",
      permanentDelete: "never",
      resourceDelete: "never",
      notebookDefault: "on",
    };

    fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const path = new URL(String(url), "http://localhost").pathname;
      if (path === "/api/settings/agent-access") {
        if (init?.method === "PATCH") {
          const patch = JSON.parse(String(init.body)) as Partial<AgentAccessSettings>;
          settings = { ...settings, ...patch };
        }
        return json(settings);
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the four policies without an auto-allow permanent delete option", async () => {
    renderWithClient(<AgentAccessCard />);

    expect(await screen.findByText("Soft delete (to Trash)")).toBeDefined();
    expect(screen.getByText("Permanent delete / empty Trash")).toBeDefined();
    expect(screen.getByText("Delete notebooks, library folders, sources")).toBeDefined();
    expect(screen.getByText("Default per-notebook agent access")).toBeDefined();

    const permanent = screen.getByRole("radiogroup", {
      name: "Permanent delete / empty Trash",
    });
    expect(within(permanent).queryByRole("radio", { name: "Allow" })).toBeNull();
    expect(within(permanent).getByRole("radio", { name: "Never" })).toBeDefined();
  });

  it("persists a policy change immediately", async () => {
    const user = userEvent.setup();
    renderWithClient(<AgentAccessCard />);

    const softDelete = await screen.findByRole("radiogroup", {
      name: "Soft delete (to Trash)",
    });
    await user.click(within(softDelete).getByRole("radio", { name: "Allow" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
      if (!patchCall) throw new Error("Expected a PATCH request");
      expect(JSON.parse(String((patchCall[1] as RequestInit).body))).toEqual({
        softDelete: "allow",
      });
    });

    await waitFor(() => {
      expect(
        within(softDelete).getByRole("radio", { name: "Allow" }).getAttribute("aria-checked"),
      ).toBe("true");
    });
  });

  it("updates the per-notebook default", async () => {
    const user = userEvent.setup();
    renderWithClient(<AgentAccessCard />);

    const notebookDefault = await screen.findByRole("radiogroup", {
      name: "Default per-notebook agent access",
    });
    await user.click(within(notebookDefault).getByRole("radio", { name: "Read-only" }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
      if (!patchCall) throw new Error("Expected a PATCH request");
      expect(JSON.parse(String((patchCall[1] as RequestInit).body))).toEqual({
        notebookDefault: "read_only",
      });
    });
  });
});
