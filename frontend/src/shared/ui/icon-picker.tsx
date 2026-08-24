import { Search, X } from "lucide-react";
import { dynamicIconImports } from "lucide-react/dynamic";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { NotebookIcon } from "@/shared/ui/notebook-icon";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";

export interface IconPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  triggerVariant?: "default" | "minimal";
}

const ALL_ICON_NAMES = Object.keys(dynamicIconImports);

const CURATED_CATEGORIES: { name: string; icons: string[] }[] = [
  {
    name: "Popular",
    icons: [
      "notebook",
      "book-open",
      "brain",
      "rocket",
      "terminal",
      "globe",
      "compass",
      "folder",
      "code",
      "cpu",
      "database",
      "hammer",
      "zap",
      "sparkles",
      "star",
      "layout",
      "file-text",
      "folder-open",
      "settings",
      "user",
      "bell",
      "calendar",
      "bookmark",
      "tag",
      "layers",
      "palette",
      "music",
      "video",
      "camera",
      "mail",
      "message-square",
      "shield",
      "target",
      "award",
    ],
  },
  {
    name: "Tech",
    icons: [
      "code",
      "cpu",
      "database",
      "terminal",
      "server",
      "laptop",
      "smartphone",
      "wifi",
      "git-branch",
      "command",
      "hard-drive",
      "monitor",
      "cloud",
      "shield-check",
      "binary",
      "rss",
    ],
  },
  {
    name: "Files",
    icons: [
      "file-text",
      "file",
      "folder",
      "folder-open",
      "files",
      "archive",
      "paperclip",
      "file-code",
      "file-json",
      "file-spreadsheet",
      "file-check",
      "folder-plus",
    ],
  },
  {
    name: "Communication",
    icons: [
      "message-square",
      "mail",
      "phone",
      "send",
      "inbox",
      "share-2",
      "at-sign",
      "bell",
      "message-circle",
      "voicemail",
    ],
  },
  {
    name: "Objects",
    icons: [
      "hammer",
      "wrench",
      "key",
      "lock",
      "scissors",
      "lightbulb",
      "compass",
      "anchor",
      "briefcase",
      "gift",
      "box",
      "shopping-bag",
    ],
  },
  {
    name: "System",
    icons: [
      "settings",
      "sliders",
      "filter",
      "power",
      "shield",
      "trash-2",
      "search",
      "refresh-cw",
      "check-circle",
      "alert-circle",
      "info",
      "help-circle",
    ],
  },
  {
    name: "Media",
    icons: [
      "image",
      "music",
      "video",
      "camera",
      "headphones",
      "film",
      "mic",
      "play",
      "volume-2",
      "sparkles",
      "radio",
      "tv",
    ],
  },
];

function formatIconLabel(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface IconItemProps {
  name: string;
  isSelected: boolean;
  isFocused: boolean;
  onClick: (name: string) => void;
  onMouseEnter: () => void;
}

const IconItem = memo(function IconItem({
  name,
  isSelected,
  isFocused,
  onClick,
  onMouseEnter,
}: IconItemProps) {
  const label = useMemo(() => formatIconLabel(name), [name]);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={() => onClick(name)}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-foreground outline-none transition-colors duration-150",
        isSelected
          ? "bg-accent text-accent-foreground"
          : isFocused
            ? "bg-muted text-foreground ring-1 ring-ring/50"
            : "hover:bg-muted/60",
      )}
    >
      <NotebookIcon name={name} className="size-4 shrink-0" />
    </button>
  );
});

const BATCH_SIZE = 60;

export function IconPicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Search for an icon",
  triggerVariant = "default",
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setDebouncedQuery("");
      setVisibleCount(BATCH_SIZE);
      setFocusedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const matchingIcons = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query) return [];

    const normalizedQuery = query.replace(/[\s_]+/g, "-");
    return ALL_ICON_NAMES.filter((name) => {
      if (name.includes(normalizedQuery)) return true;
      const parts = name.split("-");
      return parts.some((part) => part.startsWith(query));
    });
  }, [debouncedQuery]);

  const isSearching = debouncedQuery.trim().length > 0;

  const currentIcons = useMemo(() => {
    if (isSearching) {
      return matchingIcons;
    }
    const set = new Set<string>();
    for (const cat of CURATED_CATEGORIES) {
      for (const icon of cat.icons) {
        set.add(icon);
      }
    }
    return Array.from(set);
  }, [isSearching, matchingIcons]);

  const displayedMatchingIcons = useMemo(() => {
    return matchingIcons.slice(0, visibleCount);
  }, [matchingIcons, visibleCount]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 120) {
      setVisibleCount((prev) => prev + BATCH_SIZE);
    }
  }, []);

  const handleSelect = useCallback(
    (iconName: string) => {
      onChange(iconName);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;

    const COLS = 6;
    const total = currentIcons.length;

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (total === 0) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + COLS < total ? prev + COLS : prev % COLS));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev - COLS >= 0 ? prev - COLS : Math.floor((total - 1) / COLS) * COLS + (prev % COLS),
      );
    } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < total) {
      e.preventDefault();
      handleSelect(currentIcons[focusedIndex]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={value ? `Selected icon: ${value}` : "Select icon"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "group flex shrink-0 cursor-pointer items-center justify-center rounded-lg focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          triggerVariant === "minimal"
            ? "size-10 border-0 bg-transparent text-foreground transition-opacity duration-150 hover:opacity-75 focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-offset-1"
            : "size-9 border border-border bg-background transition-all hover:border-primary/50 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        <NotebookIcon
          name={value}
          className={cn(
            "text-foreground",
            triggerVariant === "minimal"
              ? "size-10 shrink-0"
              : "size-4 transition-transform group-hover:scale-110",
          )}
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[340px] gap-2 rounded-xl border border-border/70 bg-popover p-2.5 text-popover-foreground shadow-lg outline-none"
        onKeyDown={handleKeyDown}
      >
        <div className="relative flex items-center">
          <Input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="h-9 rounded-md border-border/70 bg-background/30 pr-8 pl-3 text-xs shadow-none focus-visible:border-ring/70 focus-visible:bg-background/50 focus-visible:ring-1 focus-visible:ring-ring/20"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDebouncedQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          ) : (
            <Search className="absolute right-2.5 size-4 text-muted-foreground pointer-events-none" />
          )}
        </div>

        <div
          id={listId}
          ref={scrollContainerRef}
          onScroll={handleScroll}
          role="listbox"
          aria-label="Icons"
          className="max-h-[280px] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
        >
          {isSearching ? (
            matchingIcons.length > 0 ? (
              <div className="grid gap-2">
                <div className="px-0.5 text-xs font-medium text-muted-foreground">Results</div>
                <div className="grid grid-cols-6 gap-1">
                  {displayedMatchingIcons.map((iconName, index) => (
                    <IconItem
                      key={iconName}
                      name={iconName}
                      isSelected={value === iconName}
                      isFocused={focusedIndex === index}
                      onClick={handleSelect}
                      onMouseEnter={() => setFocusedIndex(index)}
                    />
                  ))}
                </div>
                {displayedMatchingIcons.length < matchingIcons.length && (
                  <div className="py-1 text-center text-xs text-muted-foreground">
                    Scroll down for more icons...
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Search className="size-8 mb-2 stroke-1 opacity-50" />
                <p className="text-xs font-medium">No icons found</p>
                <p className="text-xs opacity-75 mt-0.5">Try searching for another keyword</p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2.5">
              {CURATED_CATEGORIES.map((category) => (
                <div key={category.name} className="flex flex-col gap-1">
                  <div className="px-0.5 text-xs font-medium text-muted-foreground">{category.name}</div>
                  <div className="grid grid-cols-6 gap-1">
                    {category.icons.map((iconName) => {
                      const globalIdx = currentIcons.indexOf(iconName);
                      return (
                        <IconItem
                          key={iconName}
                          name={iconName}
                          isSelected={value === iconName}
                          isFocused={focusedIndex === globalIdx}
                          onClick={handleSelect}
                          onMouseEnter={() => setFocusedIndex(globalIdx >= 0 ? globalIdx : -1)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
