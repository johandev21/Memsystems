import { Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/shared/utils/cn";
import { CURATED_CATEGORIES, loadAllIconNames } from "./icon-picker-data";
import { IconPickerGrid } from "./icon-picker-grid";

export interface IconPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  triggerVariant?: "default" | "minimal";
}

const BATCH_SIZE = 60;
// Fallback row pitch: size-9 cell (2.25rem) + gap-1 (0.25rem) at a 16px root.
const ROW_PITCH_FALLBACK = 40;
// Wait for the scroll to settle before pulling the viewport back onto a row.
const SNAP_SETTLE_MS = 140;

export function IconPicker({
  value,
  onChange,
  disabled = false,
  className,
  placeholder,
  triggerVariant = "default",
}: IconPickerProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("iconPicker.searchPlaceholder");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [allIconNames, setAllIconNames] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const snapTimerRef = useRef<number | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadAllIconNames().then((names) => {
      if (!cancelled) setAllIconNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setSearchQuery("");
      setDebouncedQuery("");
      setVisibleCount(BATCH_SIZE);
      setFocusedIndex(-1);
    }
  };

  const matchingIcons = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query) return [];

    const normalizedQuery = query.replace(/[\s_]+/g, "-");
    return allIconNames.filter((name) => {
      if (name.includes(normalizedQuery)) return true;
      const parts = name.split("-");
      return parts.some((part) => part.startsWith(query));
    });
  }, [allIconNames, debouncedQuery]);

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

  // Rows and category labels sit on whole multiples of the row pitch, and the
  // viewport is a whole number of rows tall, so pulling the offset onto the
  // nearest multiple always leaves whole rows at both edges. Doing it here
  // instead of with `scroll-snap-type` keeps it deterministic when the results
  // change underneath the scroller (snap-after-layout is not reliable across
  // browsers, and scroll anchoring can shift the offset on its own).
  const snapToNearestRow = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const grid = container.querySelector<HTMLElement>('[data-slot="icon-grid"]');
    const cell = grid?.firstElementChild;
    let pitch = ROW_PITCH_FALLBACK;
    if (grid && cell instanceof HTMLElement) {
      const gap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
      pitch = cell.offsetHeight + gap;
    }
    if (!Number.isFinite(pitch) || pitch <= 0) pitch = ROW_PITCH_FALLBACK;

    const target = Math.round(container.scrollTop / pitch) * pitch;
    if (Math.abs(container.scrollTop - target) > 0.5) {
      container.scrollTop = target;
    }
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollTop + clientHeight >= scrollHeight - 120) {
        setVisibleCount((prev) => prev + BATCH_SIZE);
      }
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = window.setTimeout(() => {
        snapTimerRef.current = null;
        snapToNearestRow();
      }, SNAP_SETTLE_MS);
    },
    [snapToNearestRow],
  );

  useEffect(() => {
    return () => {
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    };
  }, []);

  // A new query (or reopening the picker) starts at the first row.
  useEffect(() => {
    if (!open) return;
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = 0;
  }, [open, debouncedQuery]);

  const handleSelect = useCallback(
    (iconName: string) => {
      onChange(iconName);
      setOpen(false);
    },
    [onChange],
  );

  const handleIconMouseEnter = useCallback(
    (iconName: string) => {
      const index = currentIcons.indexOf(iconName);
      setFocusedIndex(index >= 0 ? index : -1);
    },
    [currentIcons],
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
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={value ? t("iconPicker.selectedIcon", { name: value }) : t("iconPicker.selectIcon")}
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
        <DynamicIcon
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
            placeholder={resolvedPlaceholder}
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
              aria-label={t("iconPicker.clearSearch")}
            >
              <X className="size-3" />
            </button>
          ) : (
            <Search className="absolute right-2.5 size-4 text-muted-foreground pointer-events-none" />
          )}
        </div>

        {/* The viewport is exactly 7 rows: every cell is size-9 (2.25rem) plus
            gap-1 (0.25rem) of row pitch. The grid content and category labels
            are whole multiples of that pitch too, so the JS snap below always
            lands on a row boundary. */}
        <div
          id={listId}
          ref={scrollContainerRef}
          onScroll={handleScroll}
          role="listbox"
          aria-label={t("iconPicker.ariaLabel")}
          className="max-h-70 overflow-anchor-none overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
        >
          <IconPickerGrid
            isSearching={isSearching}
            matchingIcons={matchingIcons}
            displayedMatchingIcons={displayedMatchingIcons}
            currentIcons={currentIcons}
            value={value}
            focusedIndex={focusedIndex}
            onSelect={handleSelect}
            onMouseEnter={handleIconMouseEnter}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
