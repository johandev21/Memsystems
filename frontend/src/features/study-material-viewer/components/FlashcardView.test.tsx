import { render, screen } from "@testing-library/react";
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
  it("shows only the question until the card is revealed", () => {
    render(deck());
    expect(screen.getByText("Question")).toBeTruthy();
    expect(screen.getByText(cards[0].front)).toBeTruthy();
    expect(screen.queryByText("Solution")).toBeNull();
    expect(screen.queryByText(cards[0].back)).toBeNull();
  });

  it("reveals the question above a solution divider with the answer", async () => {
    const user = userEvent.setup();
    render(deck());
    await user.click(cardSurface());
    expect(screen.getByText("Question")).toBeTruthy();
    expect(screen.getByText(cards[0].front)).toBeTruthy();
    expect(screen.getByText("Solution")).toBeTruthy();
    expect(screen.getByText(cards[0].back)).toBeTruthy();
  });

  it("hides the answer again when hidden", async () => {
    const user = userEvent.setup();
    render(deck());
    await user.click(cardSurface());
    await user.click(screen.getByRole("button", { name: /Card 1: Answer/ }));
    expect(screen.getByText(cards[0].front)).toBeTruthy();
    expect(screen.queryByText("Solution")).toBeNull();
    expect(screen.queryByText(cards[0].back)).toBeNull();
  });

  it("supports Spacebar to reveal and hide, and ignores Enter", async () => {
    const user = userEvent.setup();
    render(deck());
    const surface = cardSurface();
    surface.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByText(cards[0].back)).toBeNull();
    await user.keyboard(" ");
    expect(screen.getByText(cards[0].back)).toBeTruthy();
    await user.keyboard(" ");
    expect(screen.queryByText(cards[0].back)).toBeNull();
  });

  it("navigates between cards with left and right arrow keys", async () => {
    const user = userEvent.setup();
    render(deck());
    const surface = cardSurface();
    surface.focus();
    await user.keyboard(" ");
    expect(screen.getByText(cards[0].back)).toBeTruthy();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText(cards[1].front)).toBeTruthy();
    expect(screen.queryByText(cards[1].back)).toBeNull();
    await user.keyboard("{ArrowLeft}");
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

  it("renders a legacy fill-in-the-blank front as plain question text", async () => {
    const user = userEvent.setup();
    render(
      <FlashcardView
        materialId="legacy-cloze"
        content={{ cards: [{ front: "The capital is ___.", back: "Paris" }] }}
      />,
    );
    expect(screen.getByText("The capital is ___.")).toBeTruthy();
    await user.click(cardSurface());
    expect(screen.getByText("Paris")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
