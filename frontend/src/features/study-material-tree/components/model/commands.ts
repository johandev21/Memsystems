export type TreeCommand =
  | { type: "createFolder"; parentId: string | null }
  | { type: "renameItem"; id: string; name: string }
  | { type: "duplicateMaterial"; id: string }
  | { type: "moveItem"; id: string; targetFolderId: string | null }
  | { type: "deleteItem"; id: string };

export type CommandResult = { ok: true; newId?: string } | { ok: false; error: string };

export type TreeCommandExecutor = (command: TreeCommand) => Promise<CommandResult>;

export function getCommandPendingKey(command: TreeCommand): string {
  switch (command.type) {
    case "createFolder":
      return `create:${command.parentId ?? "root"}`;
    case "renameItem":
      return `rename:${command.id}`;
    case "duplicateMaterial":
      return `duplicate:${command.id}`;
    case "moveItem":
      return `move:${command.id}`;
    case "deleteItem":
      return `delete:${command.id}`;
  }
}
