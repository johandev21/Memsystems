export const CHAT_ENTRANCE_CLASS =
  "animate-in fade-in slide-in-from-bottom-1 duration-200 fill-mode-backwards motion-reduce:animate-none";

// Stagger only the first few turns so opening a long conversation stays fast;
// everything below the fold and newly appended turns enter immediately.
export function chatEntranceDelay(index: number): number {
  return index < 4 ? index * 35 : 0;
}
