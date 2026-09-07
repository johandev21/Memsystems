import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuizView, type QuizQuestion } from "./QuizView";

function question(id: string): QuizQuestion {
  return {
    id,
    prompt: `Question ${id}?`,
    correctOptionId: "b",
    options: [
      { id: "a", text: "First option", explanation: "First explanation." },
      { id: "b", text: "Second option", explanation: "Second explanation." },
      { id: "c", text: "Third option", explanation: "Third explanation." },
    ],
  };
}

function renderQuiz(count = 2) {
  return render(
    <QuizView
      content={{ questions: Array.from({ length: count }, (_, i) => question(String(i + 1))) }}
    />,
  );
}

describe("QuizView", () => {
  it("tracks answers rather than navigation and focuses the next question", async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Question 2")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Question 2?" }));
    await user.click(screen.getByRole("radio", { name: "B. Second option" }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByRole("status").textContent).toBe("Your answer is correct.");
  });

  it("locks the answer and limits explanations until review", async () => {
    const user = userEvent.setup();
    renderQuiz(1);
    await user.click(screen.getByRole("radio", { name: "A. First option" }));
    expect(screen.getByText("Your Answer was incorrect")).toBeTruthy();
    expect(screen.getByText("Correct Answer")).toBeTruthy();
    expect(screen.getByText("First explanation.")).toBeTruthy();
    expect(screen.getByText("Second explanation.")).toBeTruthy();
    expect(screen.queryByText("Third explanation.")).toBeNull();
    const correct = screen.getByRole("radio", { name: "B. Second option" }) as HTMLInputElement;
    expect(correct.disabled).toBe(true);
    await user.click(correct);
    expect(correct.checked).toBe(false);
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }));
    await user.click(screen.getByRole("button", { name: "Review Quiz" }));
    expect(screen.getByText("Third explanation.")).toBeTruthy();
  });

  it("honors Enter on the focused action instead of advancing the quiz", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener("send-chat-prompt", listener);
    try {
      renderQuiz();
      await user.tab();
      await user.keyboard(" ");
      expect(screen.getByText("Your Answer was incorrect")).toBeTruthy();
      screen.getByRole("button", { name: "Explain" }).focus();
      await user.keyboard("{Enter}");
      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].detail).toMatchObject({
        autoSend: false,
        focusChat: true,
      });
      expect(screen.getByText("Question 1")).toBeTruthy();
    } finally {
      window.removeEventListener("send-chat-prompt", listener);
    }
  });

  it("blocks quiz shortcuts while the unanswered dialog is open and separates skipped results", async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole("radio", { name: "B. Second option" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const heading = screen.getByRole("heading", { name: "Question 2?" });
    await user.click(screen.getByRole("button", { name: "Submit Quiz" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(heading, { key: "a" });
    fireEvent.keyDown(heading, { key: "ArrowLeft" });
    expect(screen.getByText("Question 2")).toBeTruthy();
    const submit = within(dialog).getByRole("button", { name: "Submit Anyway" });
    submit.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Quiz Complete" })).toBeTruthy();
    expect(screen.getByText("Incorrect").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByText("Unanswered").nextElementSibling?.textContent).toBe("1");
    await user.click(screen.getByRole("button", { name: "Retake Quiz" }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(
      (screen.getByRole("radio", { name: "B. Second option" }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("keeps shortcuts scoped to the quiz and supports letter selection from the question", () => {
    renderQuiz();
    fireEvent.keyDown(document.body, { key: "a" });
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    fireEvent.keyDown(screen.getByRole("heading"), { key: "b" });
    expect(screen.getByRole("status").textContent).toBe("Your answer is correct.");
  });
});
