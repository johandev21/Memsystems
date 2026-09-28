import { useCallback, useRef, useState } from "react";
import type { TreeCommandResult } from "./types";

export function usePendingTreeCommands<
  TCommand = unknown,
  TResult extends TreeCommandResult = TreeCommandResult,
>(onCommand: ((command: TCommand) => Promise<TResult>) | undefined) {
  const pendingByKey = useRef(new Map<string, boolean>());
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const isPending = useCallback((key: string) => pendingByKey.current.has(key), []);

  const setPending = useCallback((key: string, pending: boolean) => {
    if (pending) pendingByKey.current.set(key, true);
    else pendingByKey.current.delete(key);
    setPendingKeys(new Set(pendingByKey.current.keys()));
  }, []);

  const runPendingCommand = useCallback(
    async (key: string, command: TCommand): Promise<TResult | null> => {
      if (!onCommand || pendingByKey.current.has(key)) return null;
      setPending(key, true);
      try {
        return await onCommand(command);
      } finally {
        setPending(key, false);
      }
    },
    [onCommand, setPending],
  );

  return { pendingKeys, isPending, setPending, runPendingCommand };
}
