import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QaCard } from "./qa-card";

const question = "What does HTTPS add over HTTP?";
const answer = "Security. The 'S' stands for secure.";

describe("QaCard", () => {
  it("shows the question with its badge and no solution while hidden", () => {
    render(<QaCard question={question} answer={answer} isRevealed={false} />);
    expect(screen.getByText("Question")).toBeTruthy();
    expect(screen.getByText(question)).toBeTruthy();
    expect(screen.queryByText("Solution")).toBeNull();
    expect(screen.queryByText(answer)).toBeNull();
  });

  it("keeps the question visible above the solution once revealed", () => {
    render(<QaCard question={question} answer={answer} isRevealed />);
    const questionEl = screen.getByText(question);
    const dividerEl = screen.getByText("Solution");
    const answerEl = screen.getByText(answer);

    expect(questionEl).toBeTruthy();
    expect(dividerEl).toBeTruthy();
    expect(answerEl).toBeTruthy();
    expect(
      questionEl.compareDocumentPosition(dividerEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      dividerEl.compareDocumentPosition(answerEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("preserves multi-line answers", () => {
    render(<QaCard question={question} answer={"First line.\nSecond line."} isRevealed />);
    const answerEl = screen.getByText((_, el) => el?.textContent === "First line.\nSecond line.");
    expect(answerEl.textContent).toBe("First line.\nSecond line.");
  });
});
