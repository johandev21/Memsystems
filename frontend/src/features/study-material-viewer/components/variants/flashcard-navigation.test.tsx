import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlashcardNavigation } from "./flashcard-navigation";

describe("FlashcardNavigation", () => {
  it("disables navigation for a single card while allowing either rating", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onRate = vi.fn();
    render(
      <FlashcardNavigation
        cardCount={1}
        incorrectCount={2}
        correctCount={5}
        onPrev={onPrev}
        onNext={onNext}
        onRate={onRate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous Card" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Card" }));
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(onRate.mock.calls).toEqual([["incorrect"], ["correct"]]);
  });

  it("delegates navigation independently from rating for a multi-card deck", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onRate = vi.fn();
    render(
      <FlashcardNavigation
        cardCount={3}
        incorrectCount={0}
        correctCount={1}
        onPrev={onPrev}
        onNext={onNext}
        onRate={onRate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous Card" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Card" }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onRate).not.toHaveBeenCalled();
  });
});
