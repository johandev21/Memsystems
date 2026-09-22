import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stripCitationMarkersFromContent } from "@/shared/citations/citation";
import { MaterialCitations } from "./material-citations";

function source(id: string, title: string) {
  return {
    id,
    notebookId: "nb-1",
    kind: "text",
    title,
    url: null,
    contentType: null,
    fileSize: null,
    createdAt: new Date().toISOString(),
  };
}

function citation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    citationKey: "R1",
    sourceId: "src-1",
    chunkId: "chunk-1",
    chunkIndex: 0,
    sourceVersionId: null,
    locator: { pageNumber: 3 },
    number: 1,
    title: "Biology Textbook",
    kind: "text",
    url: null,
    description: null,
    quote: "Mitochondria generate most of the chemical energy.",
    ...overrides,
  };
}

function renderCitations(content: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MaterialCitations content={content} notebookId="nb-1" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MaterialCitations", () => {
  it("renders nothing when the material has no citations", () => {
    renderCitations({ title: "quiz", citations: [] });

    expect(screen.queryByLabelText("Source citations")).toBeNull();
  });

  it("shows a citation pill whose popover carries the source, span, and locator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([source("src-1", "Biology Textbook")]), {
          status: 200,
        }),
      ),
    );
    renderCitations({ title: "guide", citations: [citation()] });

    const pill = await screen.findByRole("button", {
      name: "Reference 1: Biology Textbook",
    });
    await userEvent.click(pill);

    expect(await screen.findByText("Biology Textbook")).toBeTruthy();
    expect(screen.getByText("Mitochondria generate most of the chemical energy.")).toBeTruthy();
    expect(screen.getByText("Page 3")).toBeTruthy();
  });

  it("marks a citation unavailable when the source list no longer has it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
    );
    renderCitations({ title: "guide", citations: [citation()] });

    const pill = await screen.findByRole("button", {
      name: "Reference 1: Biology Textbook",
    });
    await userEvent.click(pill);

    await waitFor(() => expect(screen.getByText("Source unavailable")).toBeTruthy());
  });

  it("strips the model's raw citation markers from generated content", () => {
    expect(
      stripCitationMarkersFromContent({
        explanation: "Mitochondria generate energy [ref:R1].",
        bullets: ["Osmosis moves water [1](#reference-R2)."],
      }),
    ).toEqual({
      explanation: "Mitochondria generate energy.",
      bullets: ["Osmosis moves water."],
    });
  });
});
