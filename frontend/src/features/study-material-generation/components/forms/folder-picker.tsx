import { Check, ChevronDown, ChevronRight, Folder, Search, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { FolderDTO } from "@/features/study-material-tree";
import {
  type FolderTreeNode,
  useStudyMaterialFolderPicker,
} from "@/features/study-material-generation/hooks/use-study-material-folder-picker";
import { cn } from "@/shared/utils/cn";

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
  const [open, setOpen] = useState(false);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);

  const {
    search,
    setSearch,
    clearSearch,
    tree,
    pathMap,
    selectedName,
    activeExpandedIds,
    toggleExpand,
    isSearching,
    searchResults,
    rootMatchesSearch,
  } = useStudyMaterialFolderPicker(notebookId, value);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "nearest" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      clearSearch();
    }
  };

  const handleSelect = (folderId: string | null) => {
    onChange(folderId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-80 max-w-md overflow-hidden rounded-2xl border border-surface-border bg-surface-1 p-0 shadow-xl"
      >
        <FolderPickerSearchInput
          search={search}
          onSearchChange={setSearch}
          onClearSearch={clearSearch}
        />
        <FolderPickerOptionList
          value={value}
          isSearching={isSearching}
          rootMatchesSearch={rootMatchesSearch}
          searchResults={searchResults}
          pathMap={pathMap}
          tree={tree}
          activeExpandedIds={activeExpandedIds}
          selectedItemRef={selectedItemRef}
          onToggleExpand={toggleExpand}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}

interface FolderPickerSearchInputProps {
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
}

function FolderPickerSearchInput({
  search,
  onSearchChange,
  onClearSearch,
}: FolderPickerSearchInputProps) {
  const { t } = useTranslation("notebooks");

  return (
    <div className="flex items-center gap-2 border-b border-surface-border bg-surface-2 px-3 py-2">
      <Search className="size-4 shrink-0 text-text-faint" />
      <input
        type="text"
        placeholder={t("folders.searchPlaceholder")}
        aria-label={t("folders.searchPlaceholder")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && search) {
            e.stopPropagation();
            onClearSearch();
          }
        }}
        className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint text-text-primary"
      />
      {search && (
        <button
          type="button"
          onClick={onClearSearch}
          aria-label="Clear search"
          className="rounded p-0.5 text-text-faint hover:text-text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

interface FolderPickerOptionListProps {
  value: string | null;
  isSearching: boolean;
  rootMatchesSearch: boolean;
  searchResults: FolderDTO[];
  pathMap: Map<string, string>;
  tree: FolderTreeNode[];
  activeExpandedIds: Set<string>;
  selectedItemRef: React.RefObject<HTMLButtonElement | null>;
  onToggleExpand: (folderId: string) => void;
  onSelect: (folderId: string | null) => void;
}

function FolderPickerOptionList({
  value,
  isSearching,
  rootMatchesSearch,
  searchResults,
  pathMap,
  tree,
  activeExpandedIds,
  selectedItemRef,
  onToggleExpand,
  onSelect,
}: FolderPickerOptionListProps) {
  const { t } = useTranslation("notebooks");

  return (
    <div className="max-h-70 overflow-y-auto p-1.5 space-y-0.5">
      {isSearching ? (
        <>
          {rootMatchesSearch && (
            <FolderSearchResultRow
              label={t("folders.notebookRoot")}
              path={null}
              selected={value === null}
              selectedRef={value === null ? selectedItemRef : undefined}
              onSelect={() => onSelect(null)}
            />
          )}
          {searchResults.map((folder) => (
            <FolderSearchResultRow
              key={folder.id}
              label={folder.name}
              path={pathMap.get(folder.id) ?? null}
              selected={value === folder.id}
              selectedRef={value === folder.id ? selectedItemRef : undefined}
              onSelect={() => onSelect(folder.id)}
            />
          ))}
          {!rootMatchesSearch && searchResults.length === 0 && (
            <div className="py-6 text-center text-xs text-text-faint">
              {t("folders.noFoldersFound")}
            </div>
          )}
        </>
      ) : (
        <>
          <FolderTreeRow
            label={t("folders.notebookRoot")}
            depth={0}
            selected={value === null}
            hasChildren={false}
            isExpanded={false}
            selectedRef={value === null ? selectedItemRef : undefined}
            onSelect={() => onSelect(null)}
          />
          {tree.map((node) => (
            <StudyMaterialFolderBranch
              key={node.folder.id}
              node={node}
              depth={0}
              value={value}
              expandedIds={activeExpandedIds}
              selectedItemRef={selectedItemRef}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  );
}

function StudyMaterialFolderBranch({
  node,
  depth,
  value,
  expandedIds,
  selectedItemRef,
  onToggleExpand,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  value: string | null;
  expandedIds: Set<string>;
  selectedItemRef: React.RefObject<HTMLButtonElement | null>;
  onToggleExpand: (folderId: string) => void;
  onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.folder.id);
  const selected = value === node.folder.id;

  return (
    <>
      <FolderTreeRow
        label={node.folder.name}
        depth={depth}
        selected={selected}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        selectedRef={selected ? selectedItemRef : undefined}
        onToggleExpand={() => onToggleExpand(node.folder.id)}
        onSelect={() => onSelect(node.folder.id)}
      />
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <StudyMaterialFolderBranch
            key={child.folder.id}
            node={child}
            depth={depth + 1}
            value={value}
            expandedIds={expandedIds}
            selectedItemRef={selectedItemRef}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function FolderTreeRow({
  label,
  depth,
  selected,
  hasChildren,
  isExpanded,
  selectedRef,
  onToggleExpand,
  onSelect,
}: {
  label: string;
  depth: number;
  selected: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  selectedRef?: React.RefObject<HTMLButtonElement | null>;
  onToggleExpand?: () => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation("notebooks");

  return (
    <div
      style={{ "--picker-indent": `${4 + depth * 14}px` } as CSSProperties}
      className={cn(
        "group flex w-full items-center gap-1 rounded-xl py-1 pr-2 text-left text-sm transition-colors cursor-pointer pl-(--picker-indent)",
        selected
          ? "bg-surface-3 text-text-primary font-medium"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          aria-label={isExpanded ? t("folders.collapseFolder") : t("folders.expandFolder")}
          className="size-5 flex items-center justify-center rounded hover:bg-surface-3 text-text-faint hover:text-text-primary shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform duration-150", isExpanded && "rotate-90")}
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}

      <button
        ref={selectedRef}
        type="button"
        onClick={onSelect}
        title={label}
        className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
      >
        <Folder className="size-3.5 shrink-0 text-text-faint group-hover:text-text-secondary" />
        <span className="truncate flex-1">{label}</span>
        {selected && <Check className="size-3.5 shrink-0 text-primary" />}
      </button>
    </div>
  );
}

function FolderSearchResultRow({
  label,
  path,
  selected,
  selectedRef,
  onSelect,
}: {
  label: string;
  path: string | null;
  selected: boolean;
  selectedRef?: React.RefObject<HTMLButtonElement | null>;
  onSelect: () => void;
}) {
  return (
    <button
      ref={selectedRef}
      type="button"
      onClick={onSelect}
      title={path ? `${path} / ${label}` : label}
      className={cn(
        "group flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        selected
          ? "bg-surface-3 text-text-primary font-medium"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <Folder className="size-4 shrink-0 text-text-faint group-hover:text-text-secondary" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate text-sm text-text-primary leading-tight">{label}</span>
        {path && (
          <span className="truncate text-xs text-text-faint leading-tight mt-0.5">{path}</span>
        )}
      </div>
      {selected && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  );
}
