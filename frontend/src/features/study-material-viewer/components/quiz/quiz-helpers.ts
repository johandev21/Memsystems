import i18n from "@/shared/i18n";

export interface QuizQuestionOption {
  id: string;
  text: string;
  explanation: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizQuestionOption[];
  correctOptionId: string;
  hint?: string;
  topic?: string;
}

export function getCorrectOptionIndex(q: QuizQuestion): number {
  return q.options.findIndex((option) => option.id === q.correctOptionId);
}

export function formatExplanationText(explanation: string): string {
  if (!explanation) return "";
  const cleaned = explanation
    .replace(/^(correct|incorrect|not quite|right answer)[.:!\s]*/i, "")
    .trim();
  return cleaned || explanation;
}

export function handleExplainInChat(question: QuizQuestion, selectedIdx: number | undefined) {
  const correctIdx = getCorrectOptionIndex(question);
  const selectedOption = selectedIdx !== undefined ? question.options[selectedIdx] : null;
  const correctOption = question.options[correctIdx];
  const isCorrect = selectedIdx === correctIdx;
  const status = i18n.t(
    isCorrect ? "quiz.prompts.statusCorrect" : "quiz.prompts.statusIncorrect",
    { ns: "viewer" },
  );
  const selectedLine = selectedOption
    ? i18n.t("quiz.prompts.selectedAnswer", {
        ns: "viewer",
        text: selectedOption.text,
        status,
      })
    : i18n.t("quiz.prompts.noAnswer", { ns: "viewer" });
  const explanationLine = selectedOption?.explanation
    ? i18n.t("quiz.prompts.providedExplanation", {
        ns: "viewer",
        text: formatExplanationText(selectedOption.explanation),
      })
    : i18n.t("quiz.prompts.correctExplanation", {
        ns: "viewer",
        text: formatExplanationText(correctOption.explanation),
      });
  const incorrectLine =
    selectedOption && !isCorrect
      ? i18n.t("quiz.prompts.whyIncorrect", { ns: "viewer", text: selectedOption.text })
      : "";

  const promptText = i18n.t("quiz.prompts.explain", {
    ns: "viewer",
    question: question.prompt,
    selected: selectedLine,
    answer: correctOption.text,
    explanation: explanationLine,
    incorrect: incorrectLine,
  });

  window.dispatchEvent(
    new CustomEvent("send-chat-prompt", {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}
