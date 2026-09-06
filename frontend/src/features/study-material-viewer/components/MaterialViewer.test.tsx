import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudyMaterialDTO } from "../types";
import { MaterialViewer } from "./MaterialViewer";

const flashcards: StudyMaterialDTO = {
  id: "flashcards-1",
  notebookId: "notebook-1",
  kind: "simple_flashcard",
  title: "Biology flashcards",
  folderId: null,
  content: {
    cards: [
      { front: "What is photosynthesis?", back: "The conversion of light into chemical energy." },
      { front: "What is chlorophyll?", back: "A light absorbing pigment." },
    ],
  },
  options: null,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const quiz: StudyMaterialDTO = {
  ...flashcards,
  id: "quiz-1",
  kind: "quiz",
  title: "Biology quiz",
  content: {
    questions: [
      {
        id: "q1",
        prompt: "Which process uses light energy?",
        correctOptionId: "a",
        options: [
          { id: "a", text: "Photosynthesis", explanation: "It stores light energy." },
          { id: "b", text: "Respiration", explanation: "It releases stored energy." },
        ],
      },
      {
        id: "q2",
        prompt: "Which pigment absorbs light?",
        correctOptionId: "a",
        options: [
          { id: "a", text: "Chlorophyll", explanation: "It absorbs light." },
          { id: "b", text: "Keratin", explanation: "It is a structural protein." },
        ],
      },
    ],
  },
};

function renderViewer(material: StudyMaterialDTO, options?: { defaultFullscreen?: boolean; forceFullscreen?: boolean }) {
  const onClose = vi.fn();
  render(<MaterialViewer material={material} onClose={onClose} {...options} />);
  return onClose;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("MaterialViewer Explain handoff", () => {
  it("returns desktop fullscreen to the inline layout while retaining flashcard state", async () => {
    const user = userEvent.setup();
    renderViewer(flashcards, { defaultFullscreen: true });

    await user.click(screen.getByRole("button", { name: /Card 1: Question/ }));
    expect(screen.getByText("The conversion of light into chemical energy.")).toBeTruthy();

    vi.useFakeTimers();
    act(() => {
      window.dispatchEvent(
        new CustomEvent("send-chat-prompt", { detail: { focusChat: true, autoSend: false } }),
      );
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByRole("button", { name: "Return to Studio overview" })).toBeNull();
    expect(screen.getByText("The conversion of light into chemical energy.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Return to Fullscreen/i })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Return to Fullscreen/i }));
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByText("The conversion of light into chemical energy.")).toBeTruthy();
  });

  it("keeps an inline viewer visible when Explain is used", async () => {
    const user = userEvent.setup();
    const onClose = renderViewer(flashcards);

    await user.click(screen.getByRole("button", { name: "Explain" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Explain" })).toBeTruthy();
    expect(screen.getByText("What is photosynthesis?")).toBeTruthy();
  });

  it("does not close a force fullscreen viewer when a quiz explanation is handed to chat", async () => {
    const user = userEvent.setup();
    const onClose = renderViewer(quiz, { forceFullscreen: true });

    await user.click(screen.getByRole("radio", { name: "A. Photosynthesis" }));
    await user.click(screen.getByRole("button", { name: "Explain" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Which process uses light energy?")).toBeTruthy();
    expect((screen.getByRole("radio", { name: "A. Photosynthesis" }) as HTMLInputElement).checked).toBe(true);
  });
});
