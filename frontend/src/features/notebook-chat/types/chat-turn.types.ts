import type { UIMessage } from "@ai-sdk/react";

export type ChatTurn =
  | { type: "user"; id: string; message: UIMessage }
  | { type: "assistant"; id: string; versions: UIMessage[] };

export function isMessageCancelled(metadata: unknown): boolean {
  if (!metadata) return false;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return typeof parsed === "object" && parsed !== null && parsed.finishReason === "cancelled";
    } catch {
      return false;
    }
  }
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return (metadata as { finishReason?: unknown }).finishReason === "cancelled";
  }
  return false;
}

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
