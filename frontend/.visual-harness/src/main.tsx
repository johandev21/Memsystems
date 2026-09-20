import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MaterialViewer } from "@/features/study-material-viewer/components/MaterialViewer";
import "@/styles/globals.css";

const material = {
  id: "harness-material",
  notebookId: "harness-notebook",
  title: "Flashcard handoff check",
  kind: "simple_flashcard" as const,
  content: {
    cards: [
      { front: "Card one: What is a closure?", back: "A function bundled with its lexical environment." },
      { front: "Card two: What does review state preserve?", back: "The active card, answer side, and scroll position." },
    ],
  },
};

export function App() {
  const [selectedId, setSelectedId] = useState<string | null>(material.id);
  const [draft, setDraft] = useState("");
  const [handoff, setHandoff] = useState("idle");

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; autoSend?: boolean; focusChat?: boolean; chatNavigationRetry?: boolean }>).detail;
      if (detail.chatNavigationRetry) return;
      if (detail.prompt) setDraft(detail.prompt);
    };
    const onHandoff = (event: Event) => setHandoff((event as CustomEvent<{ suspended: boolean }>).detail.suspended ? "suspended" : "restored");
    window.addEventListener("send-chat-prompt", onPrompt);
    window.addEventListener("study-material-chat-handoff", onHandoff);
    return () => { window.removeEventListener("send-chat-prompt", onPrompt); window.removeEventListener("study-material-chat-handoff", onHandoff); };
  }, []);

  return <div className="min-h-screen bg-surface-0 p-4 text-text-primary">
    <div className="mx-auto mb-3 flex max-w-6xl flex-wrap items-center gap-3 text-sm">
      <span data-testid="selected-state">selectedId: {selectedId ?? "null"}</span>
      <span data-testid="handoff-state">handoff: {handoff}</span>
      <button className="rounded-lg border border-border px-3 py-1.5" onClick={() => window.dispatchEvent(new CustomEvent("restore-study-material"))}>Return Fullscreen</button>
      <span className="text-text-secondary">Chat draft: {draft ? "set (autoSend false)" : "empty"}</span>
    </div>
    <div className="mx-auto grid min-h-180 max-w-6xl grid-cols-[1fr_320px] gap-3 max-lg:block">
      <div className="rounded-2xl border border-border bg-panel-bg p-4"><p className="mb-4 text-xs text-text-secondary">Existing resizable workspace / fake chat</p><textarea aria-label="Chat draft" value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-32 w-full rounded-xl border border-border bg-surface-1 p-3" /></div>
      <div className="min-h-140 rounded-2xl border border-border bg-panel-bg p-2">
        {selectedId && <MaterialViewer material={material} onClose={() => setSelectedId(null)} defaultFullscreen forceFullscreen />}
      </div>
    </div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
