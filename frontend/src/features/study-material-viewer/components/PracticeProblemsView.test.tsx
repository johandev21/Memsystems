import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PracticeProblemsView } from "./PracticeProblemsView";
import type { PracticeProblemsContentType } from "../shapes/practice-problems";

function problem(id: string, overrides: Partial<PracticeProblemsContentType["problems"][number]> = {}) {
  return {
    id,
    prompt: `Prompt for ${id}.`,
    givens: [],
    constraints: [],
    hints: [`Cue for ${id}`, `Specific help for ${id}`],
    steps: [
      { id: `${id}-s1`, title: "First move", explanation: `Why first for ${id}.`, sourceIds: [] as string[] },
      { id: `${id}-s2`, title: "Second move", explanation: `Why second for ${id}.`, sourceIds: [] as string[] },
    ],
    answer: `Answer for ${id}.`,
    checklist: [`Includes units for ${id}`],
    acceptableAlternatives: [`Alt for ${id}`],
    sourceIds: [] as string[],
    ...overrides,
  };
}

function set(overrides: Partial<PracticeProblemsContentType> = {}): PracticeProblemsContentType {
  return {
    title: "newton-laws-practice-problems",
    overview: "Practice set.",
    sourceIds: [],
    problems: [problem("p-1"), problem("p-2")],
    ...overrides,
  };
}

function renderProblems(content: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PracticeProblemsView materialId="mat-1" content={content} notebookId="nb-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("PracticeProblemsView", () => {
  it("keeps the solution hidden until requested and preserves the response", async () => {
    const user = userEvent.setup();
    renderProblems(set());
    expect(screen.queryByText("Answer for p-1.")).toBeNull();
    const response = screen.getAllByLabelText("Your attempt")[0];
    await user.type(response, "F = ma");
    await user.click(screen.getAllByRole("button", { name: "Reveal full solution" })[0]);
    expect(screen.getByText("Answer for p-1.")).toBeTruthy();
    expect((screen.getAllByLabelText("Your attempt")[0] as HTMLTextAreaElement).value).toBe("F = ma");
  });

  it("reveals hints one at a time with remaining count and isolates per problem", async () => {
    const user = userEvent.setup();
    renderProblems(set());
    expect(screen.queryByText("Cue for p-1")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Reveal hint 1 of 2" })[0]);
    expect(screen.getByText("Cue for p-1")).toBeTruthy();
    expect(screen.queryByText("Specific help for p-1")).toBeNull();
    expect(screen.queryByText("Cue for p-2")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reveal hint 2 of 2" }));
    expect(screen.getByText("Specific help for p-1")).toBeTruthy();
  });

  it("reveals worked steps in order while keeping full solution available", async () => {
    const user = userEvent.setup();
    renderProblems(set());
    expect(screen.queryByText("Why first for p-1.")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Reveal step 1 of 2" })[0]);
    expect(screen.getByText("Why first for p-1.")).toBeTruthy();
    expect(screen.queryByText("Why second for p-1.")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Reveal full solution" })[0]);
    expect(screen.getByText("Answer for p-1.")).toBeTruthy();
  });

  it("stays usable without hints or references", () => {
    const { container } = renderProblems(
      set({ problems: [{ ...problem("p-1", { hints: [], sourceIds: [] }), steps: [{ id: "s", title: "T", explanation: "E", sourceIds: [] }] }] }),
    );
    expect(container.textContent).toContain("Prompt for p-1");
    expect(container.textContent).toContain("Generated without notebook sources.");
  });

  it("opens the source viewer and handles unavailable references", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "src-1", notebookId: "nb-1", kind: "text", title: "Textbook", url: null, contentType: null, fileSize: null, createdAt: new Date().toISOString() },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const opened: string[] = [];
    const listener = (event: Event) => {
      opened.push((event as CustomEvent<{ sourceId: string }>).detail.sourceId);
    };
    window.addEventListener("open-source-viewer", listener);
    const user = userEvent.setup();
    renderProblems(
      set({
        sourceIds: ["src-1"],
        problems: [problem("p-1", { sourceIds: ["src-1"] })],
      }),
    );
    const reference = await screen.findByRole("button", { name: "Textbook" });
    await user.click(reference);
    await waitFor(() => expect(opened).toEqual(["src-1"]));
    window.removeEventListener("open-source-viewer", listener);
  });

  it("keeps problems usable when a referenced source is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
    const { container } = renderProblems(
      set({ sourceIds: ["gone"], problems: [problem("p-1", { sourceIds: ["gone"] })] }),
    );
    await waitFor(() => expect(container.textContent).toContain("Source unavailable"));
    expect(container.textContent).toContain("Prompt for p-1");
  });

  it("rates attempts, retries needs-practice, and persists across reload", async () => {
    const user = userEvent.setup();
    const { unmount, container } = renderProblems(set());
    await user.click(screen.getAllByRole("button", { name: "Reveal full solution" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Needs practice" })[0]);
    await waitFor(() => expect(container.textContent).toContain("1 need practice"));
    unmount();
    const rerender = renderProblems(set());
    await waitFor(() => expect(rerender.container.textContent).toContain("1 need practice"));
    rerender.unmount();
  });

  it("filters to needs-practice on retry", async () => {
    const user = userEvent.setup();
    renderProblems(set());
    await user.click(screen.getAllByRole("button", { name: "Reveal full solution" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Needs practice" })[0]);
    await user.click(screen.getByRole("button", { name: /Retry needs practice/ }));
    expect(screen.queryByText("Prompt for p-2.")).toBeNull();
    expect(screen.getByText("Prompt for p-1.")).toBeTruthy();
  });

  it("retains the previous attempt when retrying a single problem", async () => {
    const user = userEvent.setup();
    renderProblems(set());
    await user.type(screen.getAllByLabelText("Your attempt")[0], "first try");
    await user.click(screen.getAllByRole("button", { name: "Reveal full solution" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Retry this problem" })[0]);
    expect((screen.getAllByLabelText("Your attempt")[0] as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("first try")).toBeTruthy();
  });
});
