import { useCallback } from "react";

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
  const handleDiscussInChat = useCallback(() => {
    const givensText =
      currentProblem.givens.length > 0
        ? `\nGivens:\n${currentProblem.givens.map((g) => `- ${g}`).join("\n")}`
        : "";
    const constraintsText =
      currentProblem.constraints.length > 0
        ? `\nConstraints:\n${currentProblem.constraints.map((c) => `- ${c}`).join("\n")}`
        : "";
    dispatchChatPrompt(
      `I'm working on this practice problem and would like to discuss it:\n\n**Problem:**\n${currentProblem.prompt}\n${givensText}${constraintsText}\n\nCan you help me understand the core concepts and guide me on how to approach solving it?`,
    );
  }, [currentProblem]);

  const handleAskSocraticHint = useCallback(() => {
    dispatchChatPrompt(
      `I'm working on this practice problem and I'm feeling a bit stuck:\n\n**Problem:**\n${currentProblem.prompt}\n\nWithout giving away the complete answer or worked steps, could you give me a Socratic hint or guiding question to help me figure out the next step myself?`,
    );
  }, [currentProblem]);

  const handleExplainStepInChat = useCallback(
    (stepNumber: number, title: string, explanation: string) => {
      dispatchChatPrompt(
        `I'm reviewing the worked steps for this practice problem:\n\n**Problem:**\n${currentProblem.prompt}\n\n**Step ${stepNumber}: ${title}**\n${explanation}\n\nCan you explain this step in more detail, clarify why this method was chosen, and walk me through the reasoning?`,
      );
    },
    [currentProblem],
  );

  return { handleDiscussInChat, handleAskSocraticHint, handleExplainStepInChat };
}
