import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import type { AgentAuditEntry, AgentKey } from "../api/agent-access";
import { AgentAuditDialog } from "./agent-audit-dialog";

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

const keys: AgentKey[] = [
  {
    id: "key-1",
    name: "Claude Code",
    prefix: "msk_ab12cd34",
    createdAt: "2026-01-01T10:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
  },
];

function entry(overrides: Partial<AgentAuditEntry> = {}): AgentAuditEntry {
  return {
    id: "entry-1",
    agentKeyId: "key-1",
    toolName: "create_notebook",
    args: { title: "Plato", text: "[redacted 5 chars]" },
    status: "success",
    errorMessage: null,
    durationMs: 42,
    notebookId: "nb-1",
    createdAt: "2026-01-02T12:00:00.000Z",
    ...overrides,
  };
}

describe("AgentAuditDialog", () => {
  let auditUrls: string[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await i18n.loadNamespaces(["settings"]);
    await i18n.changeLanguage("en");
    auditUrls = [];

    fetchMock = vi.fn(async (url: unknown) => {
      const parsed = new URL(String(url), "http://localhost");
      if (parsed.pathname === "/api/settings/agent-keys") {
        return json({ keys });
      }
      if (parsed.pathname === "/api/settings/agent-audit") {
        auditUrls.push(parsed.search);
        const status = parsed.searchParams.get("status");
        const entries =
          status === "error"
            ? [entry({ id: "entry-2", toolName: "delete_source", status: "error" })]
            : [entry()];
        return json({ entries, total: entries.length });
      }
      throw new Error(`Unexpected request: ${parsed.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists activity and filters by status", async () => {
    const user = userEvent.setup();
    renderWithClient(<AgentAuditDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText("create_notebook")).toBeDefined();
    expect(screen.getByText("Success")).toBeDefined();
    expect(screen.getByText("Key: Claude Code")).toBeDefined();

    await user.click(
      screen.getByRole("combobox", { name: "Filter by status" }),
    );
    await user.click(await screen.findByRole("option", { name: "Error" }));

    expect(await screen.findByText("delete_source")).toBeDefined();
    await waitFor(() => {
      expect(auditUrls.some((search) => search.includes("status=error"))).toBe(true);
    });
  });

  it("shows an empty state when there is no activity", async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      const parsed = new URL(String(url), "http://localhost");
      if (parsed.pathname === "/api/settings/agent-keys") {
        return json({ keys });
      }
      return json({ entries: [], total: 0 });
    });

    renderWithClient(<AgentAuditDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText("No agent activity yet")).toBeDefined();
  });
});
