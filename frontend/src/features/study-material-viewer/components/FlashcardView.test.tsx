import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FlashcardView } from "./FlashcardView";

const cards = [
  { front: "What is the first question?", back: "First answer." },
  { front: "What is the second question?", back: "Second answer." },
  { front: "What is the third question?", back: "Third answer." },
];

function deck(materialId = "flashcards-test") {
  return <FlashcardView materialId={materialId} content={{ cards }} />;
}

function cardSurface() {
  return screen.getByRole("button", { name: /Card 1: Question/ });
}

describe("FlashcardView", () => {
  it("flips in both directions when the card surface is clicked", async () => {
    const user = userEvent.setup();
    render(deck());
    await user.click(cardSurface());
    expect(screen.getByText(cards[0].back)).toBeTruthy();
    expect(screen.queryByText(cards[0].front)).toBeNull();
    await user.click(screen.getByRole("button", { name: /Card 1: Answer/ }));
    expect(screen.getByText(cards[0].front)).toBeTruthy();
    expect(screen.queryByText(cards[0].back)).toBeNull();
    expect(screen.queryByRole("button", { name: /Show Answer|Show Question/ })).toBeNull();
    expect(screen.queryByText("Need Practice")).toBeNull();
    expect(screen.queryByText("Know It")).toBeNull();
  });

  it("supports Enter and Space on the card surface without nested controls", async () => {
    const user = userEvent.setup();
    render(deck());
    const surface = cardSurface();
    surface.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(cards[0].back)).toBeTruthy();
    await user.keyboard(" ");
    expect(screen.getByText(cards[0].front)).toBeTruthy();
  });

  it("navigates with footer controls and resets the new card to its question", async () => {
    const user = userEvent.setup();
    render(deck());
    await user.click(cardSurface());
    await user.click(screen.getByRole("button", { name: "Next Card" }));
    expect(screen.getByText(cards[1].front)).toBeTruthy();
    expect(screen.queryByText(cards[1].back)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Previous Card" }));
    expect(screen.getByText(cards[0].front)).toBeTruthy();
  });

  it("starts fresh on reopen without reading or saving progress", async () => {
    const user = userEvent.setup();
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    try {
      const first = render(deck());
      await user.click(cardSurface());
      first.unmount();
      render(deck());
      expect(screen.getByText(cards[0].front)).toBeTruthy();
      expect(screen.queryByText(cards[0].back)).toBeNull();
      expect(read).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });

  it("dispatches an Explain draft event for the active card", async () => {
    const user = userEvent.setup();
    const listener = vi.fn();
    window.addEventListener("send-chat-prompt", listener);
    try {
      render(deck());
      await user.click(screen.getByRole("button", { name: "Explain" }));
      expect(listener).toHaveBeenCalledOnce();
      const event = listener.mock.calls[0][0] as CustomEvent<{
        prompt: string;
        autoSend: boolean;
        focusChat: boolean;
      }>;
      expect(event.detail).toMatchObject({ autoSend: false, focusChat: true });
      expect(event.detail.prompt).toContain(cards[0].front);
      expect(event.detail.prompt).toContain(cards[0].back);
    } finally {
      window.removeEventListener("send-chat-prompt", listener);
    }
  });

  it("keeps cloze inputs independent from card flipping and resets on navigation", async () => {
    vi.useFakeTimers();
    try {
      render(
        <FlashcardView
          materialId="cloze-test"
          content={{ cards: [{ front: "The capital is ___.", back: "Paris" }, cards[1]] }}
        />,
      );
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Paris" } });
      fireEvent.click(screen.getByRole("button", { name: "Check Answer" }));
      expect(screen.getByRole("status").textContent).toMatch(/correct/i);
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Paris");
      fireEvent.click(screen.getByRole("button", { name: "Next Card" }));
      fireEvent.click(screen.getByRole("button", { name: "Previous Card" }));
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });
});
