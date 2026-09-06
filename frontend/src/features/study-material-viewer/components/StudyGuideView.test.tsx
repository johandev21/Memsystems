import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyGuideView } from "./StudyGuideView";
import type { StudyGuideContentType } from "../shapes/study-guide";

function section(id: string, overrides: Partial<StudyGuideContentType["sections"][number]> = {}) {
  return {
    id,
    title: `Section ${id}`,
    explanation: `Explanation for ${id}.`,
    keyConcepts: [`Concept of ${id}`],
    examples: [`Example of ${id}`],
    misconceptions: [],
    takeaways: [],
    sourceIds: [],
    ...overrides,
  };
}

function guide(overrides: Partial<StudyGuideContentType> = {}): StudyGuideContentType {
  return {
    title: "photosynthesis-study-guide",
    overview: "How plants convert light into chemical energy.",
    learningObjectives: ["Explain the light-dependent reactions."],
    format: "detailed",
    sourceIds: [],
    sections: [section("s1"), section("s2")],
    ...overrides,
  };
}

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

function renderGuide(
  content: unknown,
  props: { notebookId?: string; onOpenSource?: () => void } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StudyGuideView
        content={content}
        notebookId={props.notebookId ?? "nb-1"}
        onOpenSource={props.onOpenSource}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StudyGuideView", () => {
  it("retries failed source metadata without hiding the guide", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("Offline"))
        .mockResolvedValue(
          new Response(JSON.stringify([source("src-1", "Biology Textbook")]), { status: 200 }),
        ),
    );
    renderGuide(
      guide({ sourceIds: ["src-1"], sections: [section("s1", { sourceIds: ["src-1"] })] }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Retry References" }));
    expect(await screen.findByRole("button", { name: "Biology Textbook" })).toBeTruthy();
  });

  it("sanitizes source-derived Markdown", () => {
    const { container } = renderGuide(
      guide({ overview: "<script>alert(1)</script> [unsafe](javascript:alert(1))" }),
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  });
  it("renders a readable guide with headings, objectives, and sections", () => {
    const { container } = renderGuide(guide());
    expect(screen.getByRole("heading", { name: "photosynthesis" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Learning Objectives", level: 2 })).toBeTruthy();
    expect(container.textContent).toContain("How plants convert light");
    expect(container.textContent).toContain("Explain the light-dependent reactions.");
    expect(screen.getByRole("heading", { name: "Section s1" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Section s2" })).toBeTruthy();
    expect(container.textContent).toContain("Concept of s1");
  });

  it("labels examples as generated, separate from source claims", () => {
    const { container } = renderGuide(guide());
    expect(screen.getAllByRole("heading", { name: "Generated Examples" })).toHaveLength(2);
    expect(container.textContent).toContain("Example of s1");
    expect(container.querySelector("article")).toBeTruthy();
  });

  it("marks brief-only guides as generated without notebook sources", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderGuide(guide({ sourceIds: [] }));
    expect(container.textContent).toContain("Generated without notebook sources.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("links the contents list to stable section anchors", async () => {
    const user = userEvent.setup();
    const { container } = renderGuide(guide());
    const nav = container.querySelector('nav[aria-label="Study guide contents"]');
    expect(nav).toBeTruthy();
    const links = Array.from(nav!.querySelectorAll("a"));
    expect(links).toHaveLength(2);
    for (const link of links) {
      const target = link.getAttribute("href")?.slice(1) ?? "";
      expect(document.getElementById(target)).toBeTruthy();
    }
    await user.click(links[0]);
    expect(document.activeElement?.tagName).toBe("SECTION");
  });

  it("resolves reference labels from source metadata and opens the source viewer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([source("src-1", "Biology Textbook")]), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const opened: string[] = [];
    const onOpenSource = vi.fn();
    window.addEventListener("open-source-viewer", (event) => {
      opened.push((event as CustomEvent<{ sourceId: string }>).detail.sourceId);
    });
    const user = userEvent.setup();
    renderGuide(
      guide({
        sourceIds: ["src-1"],
        sections: [section("s1", { sourceIds: ["src-1"] })],
      }),
      { onOpenSource },
    );

    const reference = await screen.findByRole("button", { name: "Biology Textbook" });
    await user.click(reference);
    await waitFor(() => expect(opened).toEqual(["src-1"]));
    expect(onOpenSource).toHaveBeenCalled();
  });

  it("keeps the guide readable when a referenced source is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
    );
    const { container } = renderGuide(
      guide({
        sourceIds: ["src-deleted"],
        sections: [section("s1", { sourceIds: ["src-deleted"] })],
      }),
    );

    await waitFor(() => expect(container.textContent).toContain("Source unavailable"));
    expect(container.textContent).toContain("Explanation for s1");
  });

  it("shows a recoverable error for invalid content instead of an unreadable guide", () => {
    renderGuide({ title: "broken" });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("reads older guides without a format using the detailed default", () => {
    const legacy = {
      title: "legacy-study-guide",
      overview: "Old overview.",
      learningObjectives: ["Old objective."],
      sections: [
        {
          id: "s1",
          title: "Old section",
          explanation: "Old explanation.",
          keyConcepts: ["Old concept"],
          examples: [],
        },
      ],
    };
    const { container } = renderGuide(legacy);
    expect(container.textContent).toContain("Detailed Guide");
    expect(container.textContent).toContain("Old explanation.");
  });

  it("labels revision sheets distinctly from detailed guides", () => {
    const { container } = renderGuide(guide({ format: "revision" }));
    expect(container.textContent).toContain("Revision Sheet");
  });
});
