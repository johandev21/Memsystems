import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useChatPanel } from "../hooks/use-chat-panel";
import { ChatSessionContext } from "./chat-session-context";

export function ChatSessionProvider({
  notebookId,
  selectedSourceId,
  children,
}: {
  notebookId: string;
  selectedSourceId?: string | null;
  children: ReactNode;
}) {
  return (
    <NotebookChatSessionProvider
      key={notebookId}
      notebookId={notebookId}
      selectedSourceId={selectedSourceId}
    >
      {children}
    </NotebookChatSessionProvider>
  );
}

function NotebookChatSessionProvider({
  notebookId,
  selectedSourceId,
  children,
}: {
  notebookId: string;
  selectedSourceId?: string | null;
  children: ReactNode;
}) {
  const sourceIds = useMemo(
    () => (selectedSourceId ? [selectedSourceId] : undefined),
    [selectedSourceId],
  );
  const mountedPanelsRef = useRef(new Set<HTMLElement>());
  const activePanelRef = useMemo(() => ({
    get current() {
      const panels = [...mountedPanelsRef.current];
      return panels.find((panel) => panel.getClientRects().length > 0) ?? panels[0] ?? null;
    },
  }), []);
  const registerPanel = useCallback((element: HTMLElement | null) => {
    if (!element) return undefined;
    mountedPanelsRef.current.add(element);
    return () => mountedPanelsRef.current.delete(element);
  }, []);
  const session = useChatPanel(notebookId, activePanelRef, sourceIds);
  const stopRef = useRef(session.stop);
  useEffect(() => {
    stopRef.current = session.stop;
  }, [session.stop]);
  useEffect(() => () => {
    void stopRef.current();
  }, []);
  const value = useMemo(() => ({ session, registerPanel }), [registerPanel, session]);

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}
