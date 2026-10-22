import { createContext } from "react";
import type { useChatPanel } from "../hooks/use-chat-panel";

export type ChatSession = ReturnType<typeof useChatPanel>;

export interface SharedChatSession {
  session: ChatSession;
  registerPanel: (element: HTMLElement | null) => (() => void) | undefined;
}

export const ChatSessionContext = createContext<SharedChatSession | null>(null);
