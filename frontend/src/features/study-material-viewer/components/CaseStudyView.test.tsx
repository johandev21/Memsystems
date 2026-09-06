import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseStudyView } from "./CaseStudyView";

const content = {
  title: "Resource Allocation",
  learningObjectives: ["Compare competing priorities."],
  scenario: {
    title: "A Team Decision",
    setting: "A small team.",
    narrative: "Two projects need funding.",
  },
  facts: ["Only one project can be funded."],
  questions: [{ id: "q1", prompt: "Which project would you choose?" }],
  analyses: [
    {
      questionId: "q1",
      reasoning: "Consider the opportunity cost.",
      checklist: ["I compared both projects."],
    },
  ],
};

function renderCase(study: unknown = content) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CaseStudyView materialId="case-1" notebookId="nb-1" content={study} />
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CaseStudyView", () => {
  it("reveals analysis without requiring a response and keeps the toggle focused", async () => {
    const user = userEvent.setup();
    renderCase();
    expect(screen.getByRole("heading", { name: "Learning Objectives", level: 2 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset Progress" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sample Reasoning" })).toBeNull();
    const toggle = screen.getByRole("button", { name: "Reveal Analysis" });
    await user.click(toggle);
    expect(screen.getByRole("heading", { name: "Sample Reasoning", level: 3 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide Analysis" })).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle);
    expect(screen.queryByRole("heading", { name: "Sample Reasoning" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("preserves work when hiding analysis or canceling reset, and clears all progress on confirmation", async () => {
    const user = userEvent.setup();
    renderCase();
    const response = screen.getByRole("textbox", { name: "Your Response" }) as HTMLTextAreaElement;
    await user.type(response, "Fund project A.");
    await user.click(screen.getByRole("button", { name: "Reveal Analysis" }));
    await user.click(screen.getByRole("checkbox", { name: "I compared both projects." }));
    await user.click(screen.getByRole("button", { name: "Hide Analysis" }));
    await user.click(screen.getByRole("button", { name: "Reveal Analysis" }));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("button", { name: "Reset Progress" }));
    expect(
      screen.getByText(/Clear all responses, checklist selections, and revealed analyses/),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(response.value).toBe("Fund project A.");
    await user.click(screen.getByRole("button", { name: "Reset Progress" }));
    await user.click(screen.getByRole("button", { name: "Confirm Reset" }));
    expect(response.value).toBe("");
    expect(localStorage.getItem("case-study-progress-case-1")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset Progress" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sample Reasoning" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reveal Analysis" }));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("replaces the saved message on storage failure while keeping the response editable", async () => {
    const user = userEvent.setup();
    renderCase();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage full");
    });
    const response = screen.getByRole("textbox", { name: "Your Response" }) as HTMLTextAreaElement;
    await user.type(response, "My answer");
    expect(screen.getByRole("alert").textContent).toContain("Progress could not be saved");
    expect(screen.queryByText("Progress is saved on this device.")).toBeNull();
    expect(response.value).toBe("My answer");
  });

  it("allows responses and retries when supporting sources fail to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("Offline"))
        .mockResolvedValue(
          new Response(JSON.stringify([{ id: "src-1", title: "Decision Making" }]), {
            status: 200,
          }),
        ),
    );
    const user = userEvent.setup();
    renderCase({
      ...content,
      sourceIds: ["src-1"],
      analyses: [{ ...content.analyses[0], sourceIds: ["src-1"] }],
    });
    const retry = await screen.findByRole("button", { name: "Retry References" });
    await user.type(screen.getByRole("textbox"), "A preliminary response.");
    await user.click(screen.getByRole("button", { name: "Reveal Analysis" }));
    await user.click(retry);
    expect(await screen.findByRole("button", { name: "Decision Making" })).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "A preliminary response.",
    );
  });
});
