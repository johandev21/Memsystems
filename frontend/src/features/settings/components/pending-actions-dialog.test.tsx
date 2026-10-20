import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import type { AgentPendingAction } from "../api/agent-access";
import { PendingActionsDialog } from "./pending-actions-dialog";

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
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function pendingAction(
  overrides: Partial<AgentPendingAction> = {},
): AgentPendingAction {
  return {
    id: "action-1",
    agentKeyId: "key-1",
    agentKeyName: "Claude Code",
    toolName: "delete_source",
    notebookId: "nb-1",
    targetType: "source",
    targetIds: ["src-1"],
    summary: 'Delete source "Reading" (src-1) and move it to Trash.',
    payload: null,
    status: "pending",
    errorMessage: null,
    createdAt: "2026-01-02T12:00:00.000Z",
    expiresAt: "2026-01-02T12:15:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("PendingActionsDialog", () => {
  let actions: AgentPendingAction[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await i18n.loadNamespaces(["settings"]);
    await i18n.changeLanguage("en");
    actions = [pendingAction()];

    fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const parsed = new URL(String(url), "http://localhost");
      if (
        parsed.pathname === "/api/agent-actions/action-1/approve" ||
        parsed.pathname === "/api/agent-actions/action-1/reject"
      ) {
        expect(init?.method).toBe("POST");
        actions = [];
        return json({
          ...pendingAction(),
          status: parsed.pathname.endsWith("approve") ? "approved" : "rejected",
        });
      }
      if (parsed.pathname === "/api/agent-actions") {
        return json({ actions, pendingCount: actions.length });
      }
      throw new Error(`Unexpected request: ${parsed.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists pending actions and approves one", async () => {
    const user = userEvent.setup();
    renderWithClient(<PendingActionsDialog open onOpenChange={() => {}} />);

    expect(
      await screen.findByText(
        'Delete source "Reading" (src-1) and move it to Trash.',
      ),
    ).toBeDefined();
    expect(screen.getByText("Pending")).toBeDefined();
    expect(screen.getByText("Key: Claude Code")).toBeDefined();
    expect(screen.getByText("Target: Source")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agent-actions/action-1/approve",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("No pending actions")).toBeDefined();
  });

  it("rejects an action without executing it", async () => {
    const user = userEvent.setup();
    renderWithClient(<PendingActionsDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText("delete_source")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agent-actions/action-1/reject",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("No pending actions")).toBeDefined();
  });

  it("shows an empty state when nothing is waiting", async () => {
    actions = [];
    renderWithClient(<PendingActionsDialog open onOpenChange={() => {}} />);

    expect(await screen.findByText("No pending actions")).toBeDefined();
  });
});
