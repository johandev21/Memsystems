import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotebookModelProvider } from "@/features/notebooks";
import i18n from "@/shared/i18n/i18n";
import { GenerateBriefDialog } from "./GenerateBriefDialog";
import { useGenerationStore } from "../hooks/use-generation-store";

vi.mock("@/features/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/ai")>();
  return {
    ...actual,
    useConnectionStatus: () => ({ data: { ok: true } }),
    GatewayKeyPrompt: () => <div>Gateway Key Prompt</div>,
  };
});

vi.mock("@/features/sources", () => ({
  sourcesQueryOptions: () => ({
    queryKey: ["sources"],
    queryFn: () => [{ id: "src-1", title: "Source 1", kind: "file" }],
  }),
}));

const VERIFIED_CATALOG = {
  models: [
    {
      id: "openai/gpt-5.6-sol",
      displayName: "GPT-5.6 Sol",
      capabilities: { structuredOutput: true },
    },
  ],
  capabilitiesVerified: true,
};

function stubNotebookFetch(groundingMode?: string) {
  return vi.fn(async (input: unknown) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/notebooks/nb-1") {
      return Response.json(notebook(groundingMode));
    }
    if (url.pathname === "/api/notebooks/nb-1/folders") {
      return Response.json([]);
    }
    return new Response("Not Found", { status: 404 });
  });
}

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
  queryClient.setQueryData(["models"], VERIFIED_CATALOG);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NotebookModelProvider notebookId="nb-1" initialModel="openai/gpt-5.6-sol">
          {children}
        </NotebookModelProvider>
      </QueryClientProvider>
    );
  };
}

describe("GenerateBriefDialog grounding mode", () => {
  let mockStartBackgroundGeneration: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await i18n.loadNamespaces(["generation", "notebooks"]);
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
    mockStartBackgroundGeneration = vi.fn().mockResolvedValue(undefined);
    useGenerationStore.setState({
      startBackgroundGeneration: mockStartBackgroundGeneration as any,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows a fully empty brief-only submit in free mode and sends the mode", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubNotebookFetch("free"));
    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open
        onOpenChange={vi.fn()}
        onComplete={vi.fn()}
      />,
      { wrapper: wrapper() },
    );

    await user.click(screen.getByRole("button", { name: /Next Step/i }));

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    await waitFor(() => {
      expect((generateBtn as HTMLButtonElement).disabled).toBe(false);
    });
    expect(
      screen.getByText(
        "No sources selected — this will be generated from general knowledge.",
      ),
    ).toBeTruthy();

    await user.click(generateBtn);
    expect(mockStartBackgroundGeneration).toHaveBeenCalledWith(
      "nb-1",
      expect.objectContaining({
        kind: "quiz",
        brief: "",
        sourceIds: [],
        groundingMode: "free",
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it("blocks an empty submit when the notebook has no mode (strict fallback)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", stubNotebookFetch(undefined));
    render(
      <GenerateBriefDialog
        notebookId="nb-1"
        kind="quiz"
        open
        onOpenChange={vi.fn()}
        onComplete={vi.fn()}
      />,
      { wrapper: wrapper() },
    );

    await user.click(screen.getByRole("button", { name: /Next Step/i }));

    const generateBtn = screen.getByRole("button", { name: "Generate" });
    expect((generateBtn as HTMLButtonElement).disabled).toBe(true);
    expect(mockStartBackgroundGeneration).not.toHaveBeenCalled();
  });
});
