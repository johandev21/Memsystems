import type { UIMessage } from "@ai-sdk/react";

export type ChatTurn =
  | { type: "user"; id: string; message: UIMessage }
  | { type: "assistant"; id: string; versions: UIMessage[] };

export function groupMessagesIntoTurns(messages: UIMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      turns.push({ type: "user", id: msg.id, message: msg });
    } else if (msg.role === "assistant") {
      const lastTurn = turns[turns.length - 1];
      if (lastTurn && lastTurn.type === "assistant") {
        const existingIdx = lastTurn.versions.findIndex((v) => v.id === msg.id);
        if (existingIdx >= 0) {
          lastTurn.versions[existingIdx] = msg;
        } else {
          lastTurn.versions.push(msg);
        }
      } else {
        turns.push({
          type: "assistant",
          id: msg.id,
          versions: [msg],
        });
      }
    }
  }

  return turns;
}
