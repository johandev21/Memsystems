import { Input as InputPrimitive } from "@base-ui/react/input";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TreeSize } from "./types";

export interface InlineRenameProps {
  initialValue: string;
  onCancel: () => void;
  onCommit: (value: string) => void;
  ariaLabel?: string;
  size?: TreeSize;
  className?: string;
}

export function InlineRename({
  initialValue,
  onCancel,
  onCommit,
  ariaLabel = "Item name",
  size = "sm",
  className,
}: InlineRenameProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter commits, then unmount fires blur with the same value. Skip the
  // duplicate so a single rename never issues two writes. Cleared on edit
  // so a retry after a failed commit still goes through.
  const lastCommittedRef = useRef<string | null>(null);

  const commit = useCallback(
    (next: string) => {
      if (lastCommittedRef.current === next) return;
      lastCommittedRef.current = next;
      onCommit(next);
    },
    [onCommit],
  );

  const handleBlur = useCallback(() => commit(value), [commit, value]);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        commit(value);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    },
    [onCancel, commit, value],
  );

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <InputPrimitive
      ref={inputRef}
      data-slot="tree-inline-rename"
      data-size={size}
      autoFocus
      aria-label={ariaLabel}
      className={
        className ??
        "min-w-0 flex-1 truncate h-auto rounded-none border-0 bg-transparent px-0 py-0 font-sans text-sm font-normal leading-none tracking-normal outline-none placeholder:text-muted-foreground/60 selection:bg-primary/20 selection:text-foreground focus:border-0 focus:bg-transparent focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
      }
      value={value}
      onBlur={handleBlur}
      onChange={(event) => {
        lastCommittedRef.current = null;
        setValue(event.target.value);
      }}
      onClick={(event) => event.stopPropagation()}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}
