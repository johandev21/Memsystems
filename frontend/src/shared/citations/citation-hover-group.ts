import { useEffect, useState } from "react";

let activeCitationId: string | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<(activeId: string | null) => void>();

function emit(id: string | null) {
  activeCitationId = id;
  for (const sub of subscribers) {
    sub(id);
  }
}

export function notifyCitationOpened(id: string) {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  emit(id);
}

export function notifyCitationClosed(id: string) {
  if (resetTimer) {
    clearTimeout(resetTimer);
  }
  // Grace period so cursor moving between adjacent citation chips retains the instant open delay
  resetTimer = setTimeout(() => {
    if (activeCitationId === id) {
      emit(null);
    }
  }, 220);
}

export function useIsAnyOtherCitationActive(id: string): boolean {
  const [isOtherActive, setIsOtherActive] = useState(
    () => activeCitationId !== null && activeCitationId !== id,
  );

  useEffect(() => {
    const handler = (activeId: string | null) => {
      setIsOtherActive(activeId !== null && activeId !== id);
    };
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }, [id]);

  return isOtherActive;
}

export function resetCitationHoverGroupForTesting() {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  activeCitationId = null;
  subscribers.clear();
}
