import { Input as InputPrimitive } from "@base-ui/react/input";
import { useEffect, useRef, useState } from "react";
import { useTreeControllerContext } from "../controller";

type InlineRenameProps = {
  initialValue: string;
  onCancel: () => void;
  onCommit: (value: string) => void;
};

export function InlineRename({ initialValue, onCancel, onCommit }: InlineRenameProps) {
  const [value, setValue] = useState(initialValue);
  const controller = useTreeControllerContext();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <InputPrimitive
      ref={inputRef}
      data-slot="study-materials-tree-inline-rename"
      data-size={controller.size}
      autoFocus
      aria-label="Item name"
      className="min-w-0 flex-1 truncate h-auto rounded-none border-0 bg-transparent px-0 py-0 font-sans text-sm font-normal leading-none tracking-normal outline-none placeholder:text-muted-foreground/60 selection:bg-primary/20 selection:text-foreground focus:border-0 focus:bg-transparent focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
      value={value}
      onBlur={() => onCommit(value)}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
    />
  );
}
