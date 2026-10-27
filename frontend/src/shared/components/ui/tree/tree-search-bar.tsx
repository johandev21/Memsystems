import { Search, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

export interface TreeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onClose?: () => void;
  placeholder?: string;
  matchCount?: number;
  isSearching?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function TreeSearchBar({
  value,
  onChange,
  onClear,
  onClose,
  placeholder,
  matchCount,
  isSearching = false,
  className,
  autoFocus = true,
}: TreeSearchBarProps) {
  const { t } = useTranslation("tree");
  const effectivePlaceholder = placeholder ?? t("search.defaultPlaceholder");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (value.length > 0) {
        onClear();
      } else if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs transition-colors focus-within:border-ring/60 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20",
        className,
      )}
    >
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={effectivePlaceholder}
        className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
      {isSearching && matchCount !== undefined && (
        <span className="shrink-0 rounded-xs bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {t("search.match", { count: matchCount })}
        </span>
      )}
      {value.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="flex size-4 shrink-0 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform"
          aria-label={t("search.clear")}
        >
          <X className="size-3" />
        </button>
      ) : onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="flex size-4 shrink-0 items-center justify-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform"
          aria-label={t("search.close")}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
