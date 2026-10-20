import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import type { AgentPendingAction } from "../api/agent-access";
import { PendingActionsIndicator } from "./pending-actions-indicator";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const action: AgentPendingAction = {
  id: "action-1",
  agentKeyId: "key-1",
  agentKeyName: "Claude Code",
  toolName: "delete_study_material",
  notebookId: "nb-1",
  targetType: "study_material",
  targetIds: ["sm-1"],
  summary: 'Delete study material "Cell biology" (sm-1) and move it to Trash.',
  payload: null,
  status: "pending",
  errorMessage: null,
  createdAt: "2026-01-02T12:00:00.000Z",
  expiresAt: "2026-01-02T12:15:00.000Z",
  resolvedAt: null,
};

describe("PendingActionsIndicator", () => {
  let pendingCount: number;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await i18n.loadNamespaces(["settings"]);
    await i18n.changeLanguage("en");
    pendingCount = 2;

    fetchMock = vi.fn(async (url: unknown) => {
      const parsed = new URL(String(url), "http://localhost");
      if (parsed.pathname === "/api/agent-actions/count") {
        return json({ pendingCount });
      }
      if (parsed.pathname === "/api/agent-actions") {
        return json({
          actions: pendingCount > 0 ? [action] : [],
          pendingCount,
        });
      }
      throw new Error(`Unexpected request: ${parsed.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a badge and opens the pending actions dialog", async () => {
    const user = userEvent.setup();
    renderWithClient(<PendingActionsIndicator />);

    const button = await screen.findByRole("button", {
      name: "2 pending agent actions",
    });
    expect(button).toBeDefined();

    await user.click(button);

    expect(
      await screen.findByText(
        'Delete study material "Cell biology" (sm-1) and move it to Trash.',
      ),
    ).toBeDefined();
  });

  it("renders nothing while the queue is empty", async () => {
    pendingCount = 0;
    renderWithClient(<PendingActionsIndicator />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agent-actions/count",
        expect.anything(),
      );
    });

    expect(
      screen.queryByRole("button", { name: /pending agent action/ }),
    ).toBeNull();
  });
});
