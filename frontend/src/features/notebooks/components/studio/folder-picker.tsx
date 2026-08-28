import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Folder, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Separator } from "@/shared/ui/separator";
import {
  type CreateFolderInput,
  createFolder,
  type FolderDTO,
  foldersQueryOptions,
} from "@/shared/api";
import { cn } from "@/shared/lib/utils";

export interface FolderPickerProps {
  notebookId: string;
  value: string | null;
  onChange: (folderId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FolderPicker({
  notebookId,
  value,
  onChange,
  disabled = false,
  className,
}: FolderPickerProps) {
  const queryClient = useQueryClient();
  const { data: folders = [] } = useQuery(foldersQueryOptions(notebookId));

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const tree = useMemo(() => buildTree(folders), [folders]);
  const selectedName = useMemo(() => {
    if (value === null) return "Notebook Root";
    return folders.find((f) => f.id === value)?.name ?? "Notebook Root";
  }, [folders, value]);

  const createMutation = useMutation({
    mutationFn: (input: CreateFolderInput) => createFolder(notebookId, input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: ["study-material-folders", notebookId],
      });
      onChange(created.id);
      setNewName("");
      toast.success(`Folder "${created.name}" created`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleCreate = () => {
    const name = newName.trim();
    if (name.length === 0) return;
    createMutation.mutate({ name });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal cursor-pointer",
              value === null && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <span className="truncate flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          {selectedName}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="max-h-[260px] overflow-y-auto p-1">
          <FolderRow
            label="Notebook Root"
            depth={0}
            selected={value === null}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          {tree.map((node) => (
            <FolderNode
              key={node.folder.id}
              node={node}
              depth={0}
              value={value}
              onSelect={(id) => {
                onChange(id);
                setOpen(false);
              }}
            />
          ))}
        </div>
        <Separator />
        <div className="p-2 flex items-center gap-1.5">
          <Input
            placeholder="New folder name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleCreate}
            disabled={newName.trim().length === 0 || createMutation.isPending}
            className="h-8 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FolderTreeNode {
  folder: FolderDTO;
  children: FolderTreeNode[];
}

function buildTree(folders: FolderDTO[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];
  for (const f of folders) {
    byId.set(f.id, { folder: f, children: [] });
  }
  for (const f of folders) {
    const node = byId.get(f.id);
    if (!node) continue;
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function FolderNode({
  node,
  depth,
  value,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  value: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <FolderRow
        label={node.folder.name}
        depth={depth}
        selected={value === node.folder.id}
        onClick={() => onSelect(node.folder.id)}
      />
      {node.children.map((child) => (
        <FolderNode
          key={child.folder.id}
          node={child}
          depth={depth + 1}
          value={value}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function FolderRow({
  label,
  depth,
  selected,
  onClick,
}: {
  label: string;
  depth: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: 8 + depth * 16 }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-xl py-1.5 pr-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        selected ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate flex-1">{label}</span>
      {selected && <Check className="h-3.5 w-3.5 text-foreground/80" />}
    </button>
  );
}
