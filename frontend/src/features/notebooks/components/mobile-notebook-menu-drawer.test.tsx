import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { Tabs } from "@/components/ui/tabs";
import { MobileNotebookMenuDrawer } from "./mobile-notebook-menu-drawer";
import { NotebookHeader } from "./notebook-header";
import { MobileTabsHeader } from "./notebook-workspace/mobile-tabs-header";
import { EditableNotebookTitle } from "./editable-notebook-title";
import { CLEAR_NOTEBOOK_CHAT_EVENT, EDIT_NOTEBOOK_EVENT } from "./dialogs/notebook-settings-dialog";

function mockNotebook(overrides: Record<string, unknown> = {}) {
  return {
    id: "nb-1",
    title: "Quantum Computing",
    description: "Introductory course",
    icon: "notebook",
    folderId: null,
    banner: null,
    bannerUrl: null,
    bannerVariants: null,
    bannerFocalPoint: null,
    groundingMode: "strict",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
    ...props
  }: {
    children: ReactNode;
    to: string;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={to} onClick={onClick} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("Mobile Notebook Workspace & Menu Drawer", () => {
  beforeEach(async () => {
    await i18n.loadNamespaces(["notebooks"]);
    await i18n.changeLanguage("en");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(mockNotebook())),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a single mobile action trigger in NotebookHeader and hides global settings on mobile", async () => {
    const { container } = render(<NotebookHeader id="nb-1" />, { wrapper: createWrapper() });

    // Global settings link is hidden on mobile (hidden sm:block container)
    const desktopSettingsWrapper = container.querySelector(".hidden.sm\\:block");
    expect(desktopSettingsWrapper).not.toBeNull();
    expect(desktopSettingsWrapper?.querySelector("a[href='/settings']")).not.toBeNull();

    // Mobile action trigger is visible on mobile (sm:hidden container)
    const mobileActionWrapper = container.querySelector(".sm\\:hidden");
    expect(mobileActionWrapper).not.toBeNull();
    const mobileTrigger = mobileActionWrapper?.querySelector("button[aria-label='Notebook settings']");
    expect(mobileTrigger).not.toBeNull();
  });

  it("renders clean MobileTabsHeader without any duplicate settings button", () => {
    render(
      <Tabs defaultValue="chat">
        <MobileTabsHeader notebookId="nb-1" />
      </Tabs>,
    );

    // Renders tabs for sources, chat, and studio
    expect(screen.getByRole("tab", { name: /sources/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /chat/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /studio/i })).toBeDefined();

    // No settings button or dialog inside MobileTabsHeader
    expect(screen.queryByRole("button", { name: /notebook settings/i })).toBeNull();
  });

  it("opens mobile drawer with notebook details, grounding mode, and navigation links", async () => {
    const user = userEvent.setup();
    render(<MobileNotebookMenuDrawer notebookId="nb-1" />, { wrapper: createWrapper() });

    const trigger = screen.getByRole("button", { name: "Notebook settings" });
    await user.click(trigger);

    // Notebook title in drawer header
    await waitFor(() => {
      expect(screen.getByText("Quantum Computing")).toBeDefined();
    });

    // Grounding mode section
    expect(screen.getByText("Grounding Mode")).toBeDefined();

    // Actions
    expect(screen.getByRole("button", { name: "Edit notebook" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Clear chat" })).toBeDefined();
    expect(screen.getByRole("link", { name: /app settings/i })).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete notebook" })).toBeDefined();
  });

  it("dispatches edit and clear chat events from drawer actions", async () => {
    const user = userEvent.setup();
    const editHandler = vi.fn();
    const clearHandler = vi.fn();

    window.addEventListener(EDIT_NOTEBOOK_EVENT, editHandler);
    window.addEventListener(CLEAR_NOTEBOOK_CHAT_EVENT, clearHandler);

    render(<MobileNotebookMenuDrawer notebookId="nb-1" />, { wrapper: createWrapper() });

    const trigger = screen.getByRole("button", { name: "Notebook settings" });
    await user.click(trigger);

    const editBtn = await screen.findByRole("button", { name: "Edit notebook" });
    await user.click(editBtn);
    expect(editHandler).toHaveBeenCalled();

    // Reopen drawer
    await user.click(trigger);
    const clearBtn = await screen.findByRole("button", { name: "Clear chat" });
    await user.click(clearBtn);
    expect(clearHandler).toHaveBeenCalled();

    window.removeEventListener(EDIT_NOTEBOOK_EVENT, editHandler);
    window.removeEventListener(CLEAR_NOTEBOOK_CHAT_EVENT, clearHandler);
  });

  it("enforces text-base (>=16px) font size on EditableNotebookTitle input to prevent iOS zoom", async () => {
    const user = userEvent.setup();
    render(<EditableNotebookTitle id="nb-1" />, { wrapper: createWrapper() });

    // Click title to enter editing mode
    const titleButton = await screen.findByRole("button", { name: "Quantum Computing" });
    await user.click(titleButton);

    const input = screen.getByRole("textbox", { name: "Edit notebook title" });
    expect(input.className).toContain("text-base");
    expect(input.className).toContain("sm:text-sm");
  });
});
