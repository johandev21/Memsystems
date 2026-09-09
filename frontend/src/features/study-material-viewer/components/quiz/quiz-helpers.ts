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

  const promptText = `I'm reviewing a quiz question and would like a deeper explanation of the concepts.

Question: ${question.prompt}
${
  selectedOption
    ? `My Selected Answer: "${selectedOption.text}" (${isCorrect ? "Correct" : "Incorrect"})`
    : "No answer selected"
}
Correct Answer: "${correctOption.text}"
${
  selectedOption?.explanation
    ? `Provided Explanation: "${formatExplanationText(selectedOption.explanation)}"`
    : `Correct Explanation: "${formatExplanationText(correctOption.explanation)}"`
}

Please explain why "${correctOption.text}" is correct${
    selectedOption && !isCorrect ? `, why "${selectedOption.text}" was incorrect` : ""
  }, and break down the underlying concepts in detail.`;

  window.dispatchEvent(
    new CustomEvent("send-chat-prompt", {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}
