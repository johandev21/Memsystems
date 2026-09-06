import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    difficulty: "medium",
    sourceIds: [],
    problems: [problem("p-1"), problem("p-2")],
    ...overrides,
  };
}

function renderProblems(
  content: unknown,
  options?: {
    onClose?: () => void;
    registerBeforeClose?: (fn: () => boolean) => void;
  },
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PracticeProblemsView
        materialId="mat-1"
        content={content}
        notebookId="nb-1"
        onClose={options?.onClose}
        registerBeforeClose={options?.registerBeforeClose}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PracticeProblemsView", () => {
  it("navigates between problems via stepper and retains attempts in session", async () => {
    const user = userEvent.setup();
    renderProblems(set());

    expect(screen.getByText("Problem 1 of 2")).toBeTruthy();
    expect(screen.getByText("Prompt for p-1.")).toBeTruthy();

    const attempt = screen.getByLabelText("Your attempt");
    await user.type(attempt, "Attempt for p-1");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Problem 2 of 2")).toBeTruthy();
    expect(screen.getByText("Prompt for p-2.")).toBeTruthy();
    expect((screen.getByLabelText("Your attempt") as HTMLTextAreaElement).value).toBe("");

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Problem 1 of 2")).toBeTruthy();
    expect((screen.getByLabelText("Your attempt") as HTMLTextAreaElement).value).toBe("Attempt for p-1");
  });

  it("reveals hints one at a time in medium mode", async () => {
    const user = userEvent.setup();
    renderProblems(set({ difficulty: "medium" }));

    expect(screen.queryByText("Cue for p-1")).toBeNull();
    expect(screen.getByText("0 of 2 hints revealed")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Reveal hint 1 of 2" }));
    expect(screen.getByText("Cue for p-1")).toBeTruthy();
    expect(screen.queryByText("Specific help for p-1")).toBeNull();
    expect(screen.getByText("1 of 2 hints revealed")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Reveal hint 2 of 2" }));
    expect(screen.getByText("Specific help for p-1")).toBeTruthy();
    expect(screen.getByText("2 of 2 hints revealed")).toBeTruthy();
  });

  it("reveals all hints and solution immediately in easy (warmup) mode", () => {
    renderProblems(set({ difficulty: "easy" }));

    expect(screen.getByText("Warmup")).toBeTruthy();
    expect(screen.getByText("Cue for p-1")).toBeTruthy();
    expect(screen.getByText("Specific help for p-1")).toBeTruthy();
    expect(screen.getByText("Answer for p-1.")).toBeTruthy();
    expect(screen.getByText("Why first for p-1.")).toBeTruthy();
  });

  it("locks solution in hard mode until AI evaluation or give up escape hatch", async () => {
    const user = userEvent.setup();
    renderProblems(set({ difficulty: "hard" }));

    expect(screen.getByText("Challenge")).toBeTruthy();
    expect(screen.getByText("Challenge Mode: Solution Locked")).toBeTruthy();
    expect(screen.queryByText("Answer for p-1.")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "Give up and reveal solution" })[0]);
    expect(screen.getByText("Answer for p-1.")).toBeTruthy();
    expect(screen.queryByText("Challenge Mode: Solution Locked")).toBeNull();
  });

  it("evaluates student attempt with AI and displays structured feedback", async () => {
    const mockEvaluation = {
      status: "correct" as const,
      feedback: "Excellent reasoning and correct final value.",
      strengths: ["Proper use of F=ma", "Correct SI units"],
      missingPoints: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockEvaluation), { status: 200 }),
      ),
    );

    const user = userEvent.setup();
    renderProblems(set());

    const attempt = screen.getByLabelText("Your attempt");
    await user.type(attempt, "F = m * a = 20 N");

    const evalButton = screen.getByRole("button", { name: "Evaluate answer" });
    await user.click(evalButton);

    await waitFor(() => {
      expect(screen.getByText("Correct")).toBeTruthy();
      expect(screen.getByText("Excellent reasoning and correct final value.")).toBeTruthy();
      expect(screen.getByText("Proper use of F=ma")).toBeTruthy();
      expect(screen.getByText("Correct SI units")).toBeTruthy();
    });
  });

  it("dispatches chat events with autoSend: false for discuss, socratic hint, and explain step", async () => {
    const dispatchedEvents: any[] = [];
    const listener = (e: Event) => {
      dispatchedEvents.push((e as CustomEvent).detail);
    };
    window.addEventListener("send-chat-prompt", listener);

    const user = userEvent.setup();
    renderProblems(set({ difficulty: "easy" }));

    // 1. Discuss in Chat
    await user.click(screen.getByRole("button", { name: /Discuss in Chat/i }));
    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].autoSend).toBe(false);
    expect(dispatchedEvents[0].focusChat).toBe(true);
    expect(dispatchedEvents[0].prompt).toContain("Prompt for p-1");

    // 2. Ask for Socratic Hint in Chat
    await user.click(screen.getByRole("button", { name: /Ask for Socratic Hint in Chat/i }));
    expect(dispatchedEvents.length).toBe(2);
    expect(dispatchedEvents[1].autoSend).toBe(false);
    expect(dispatchedEvents[1].focusChat).toBe(true);
    expect(dispatchedEvents[1].prompt).toContain("Socratic hint");

    // 3. Explain this step in Chat
    const explainStepButtons = screen.getAllByRole("button", { name: /Explain this step in Chat/i });
    await user.click(explainStepButtons[0]);
    expect(dispatchedEvents.length).toBe(3);
    expect(dispatchedEvents[2].autoSend).toBe(false);
    expect(dispatchedEvents[2].focusChat).toBe(true);
    expect(dispatchedEvents[2].prompt).toContain("Step 1: First move");

    window.removeEventListener("send-chat-prompt", listener);
  });

  it("warns about unsaved work before closing and allows leaving or staying", async () => {
    let interceptor: (() => boolean) | undefined;
    const onCloseMock = vi.fn();

    const user = userEvent.setup();
    renderProblems(set(), {
      onClose: onCloseMock,
      registerBeforeClose: (fn: () => boolean) => {
        interceptor = fn;
      },
    });

    expect(interceptor?.()).toBe(true);

    const attempt = screen.getByLabelText("Your attempt");
    await user.type(attempt, "Work in progress");

    act(() => {
      expect(interceptor?.()).toBe(false);
    });
    await waitFor(() => {
      expect(screen.getByText("Leave Practice Session?")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Stay and Practice" }));
    await waitFor(() => {
      expect(screen.queryByText("Leave Practice Session?")).toBeNull();
    });
    expect(onCloseMock).not.toHaveBeenCalled();

    act(() => {
      expect(interceptor?.()).toBe(false);
    });
    await waitFor(() => {
      expect(screen.getByText("Leave Practice Session?")).toBeTruthy();
    });
    await user.click(screen.getByRole("button", { name: "Leave Anyway" }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("opens the source viewer and handles missing sources", async () => {
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

  it("handles empty or unparseable content gracefully", () => {
    const { container } = renderProblems(null);
    expect(container.textContent).toContain("These practice problems could not be read");
  });
});
