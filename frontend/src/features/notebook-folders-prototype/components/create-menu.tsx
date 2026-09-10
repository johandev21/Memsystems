import { FolderPlus, NotebookPen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CreateMenu({
  onCreateNotebook,
  onCreateFolder,
}: {
  onCreateNotebook: () => void;
  onCreateFolder: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-lg" className="rounded-full cursor-pointer" aria-label="Create">
            <Plus className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Create new</DropdownMenuLabel>
          <DropdownMenuItem className="cursor-pointer items-start gap-3 rounded-xl px-2 py-2" onClick={onCreateNotebook}>
            <NotebookPen className="mt-0.5 size-6 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Notebook</span>
              <span className="text-xs text-muted-foreground">Start a blank notebook</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer items-start gap-3 rounded-xl px-2 py-2" onClick={onCreateFolder}>
            <FolderPlus className="mt-0.5 size-6 shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Folder</span>
              <span className="text-xs text-muted-foreground">Group notebooks together</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
