import type { TreeCommand, TreeCommandExecutor, CommandResult } from "../model/commands";
import {
  useControllableFolderExpansion,
  usePendingTreeCommands as useSharedPendingTreeCommands,
  useTreeFocusRegistry,
} from "@/components/ui/tree";

export { useControllableFolderExpansion, useTreeFocusRegistry };

export function usePendingTreeCommands(onCommand: TreeCommandExecutor | undefined) {
  return useSharedPendingTreeCommands<TreeCommand, CommandResult>(onCommand);
}
