import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import type { AgentKey } from "../api/agent-access";
import { AgentKeysDialog } from "./agent-keys-dialog";

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

function key(overrides: Partial<AgentKey> = {}): AgentKey {
  return {
    id: "key-1",
    name: "My laptop",
    prefix: "msk_ab12cd34",
    createdAt: "2026-01-01T10:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

describe("AgentKeysDialog", () => {
  let keys: AgentKey[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await i18n.loadNamespaces(["settings"]);
    await i18n.changeLanguage("en");
    keys = [];

    fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const path = new URL(String(url), "http://localhost").pathname;
      if (path === "/api/settings/agent-keys" && (!init?.method || init.method === "GET")) {
        return json({ keys });
      }
      if (path === "/api/settings/agent-keys" && init?.method === "POST") {
        const created = key({ id: "key-new", name: "Claude Code" });
        keys = [created, ...keys];
        return json(
          {
            key: "msk_plaintext_shown_once_1234567890",
            agentKey: created,
          },
          201,
        );
      }
      if (path === "/api/settings/agent-keys/key-1" && init?.method === "DELETE") {
        keys = keys.map((entry) =>
          entry.id === "key-1" ? { ...entry, revokedAt: "2026-01-02T10:00:00.000Z" } : entry,
        );
        return json({ success: true });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a newly created key exactly once with a copy warning", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <AgentKeysDialog open onOpenChange={() => {}} onViewActivity={() => {}} />,
    );

    await user.type(await screen.findByLabelText("Key name"), "Claude Code");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(await screen.findByText("msk_plaintext_shown_once_1234567890")).toBeDefined();
    expect(screen.getByText(/shown only once/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Copy key" })).toBeDefined();
    expect(await screen.findByText("Claude Code")).toBeDefined();
  });

  it("revokes a key after confirmation", async () => {
    keys = [key()];
    const user = userEvent.setup();
    renderWithClient(
      <AgentKeysDialog open onOpenChange={() => {}} onViewActivity={() => {}} />,
    );

    expect(await screen.findByText("My laptop")).toBeDefined();
    expect(screen.getByText("Active")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Revoke" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(screen.getByText("Revoked")).toBeDefined();
    });
    const deleteCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        new URL(String(url), "http://localhost").pathname ===
          "/api/settings/agent-keys/key-1" &&
        (init as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
  });
});
