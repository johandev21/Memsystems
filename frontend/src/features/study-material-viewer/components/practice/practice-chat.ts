import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export const SEND_CHAT_PROMPT_EVENT = "send-chat-prompt";

export function dispatchChatPrompt(promptText: string): void {
  window.dispatchEvent(
    new CustomEvent(SEND_CHAT_PROMPT_EVENT, {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}

export function usePracticeChatPrompts(currentProblem: {
  prompt: string;
  givens: string[];
  constraints: string[];
}) {
  const { t } = useTranslation("viewer");

  const handleDiscussInChat = useCallback(() => {
    const givensText =
      currentProblem.givens.length > 0
        ? t("practice.prompts.givens", {
            values: currentProblem.givens.map((g) => `- ${g}`).join("\n"),
          })
        : "";
    const constraintsText =
      currentProblem.constraints.length > 0
        ? t("practice.prompts.constraints", {
            values: currentProblem.constraints.map((c) => `- ${c}`).join("\n"),
          })
        : "";
    dispatchChatPrompt(
      t("practice.prompts.discuss", {
        problem: currentProblem.prompt,
        givens: givensText,
        constraints: constraintsText,
      }),
    );
  }, [currentProblem, t]);

  const handleAskSocraticHint = useCallback(() => {
    dispatchChatPrompt(
      t("practice.prompts.socratic", {
        problem: currentProblem.prompt,
      }),
    );
  }, [currentProblem, t]);

  const handleExplainStepInChat = useCallback(
    (stepNumber: number, title: string, explanation: string) => {
      dispatchChatPrompt(
        t("practice.prompts.explainStep", {
          problem: currentProblem.prompt,
          number: stepNumber,
          title,
          explanation,
        }),
      );
    },
    [currentProblem, t],
  );

  return { handleDiscussInChat, handleAskSocraticHint, handleExplainStepInChat };
}
