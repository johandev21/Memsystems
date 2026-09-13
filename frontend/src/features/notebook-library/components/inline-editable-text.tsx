import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InlineEditableText({
  value,
  onSave,
  onCancel,
  onDismiss,
  onEditingChange,
  ariaLabel,
  className,
  inputClassName,
  multiline = false,
  autoSize = false,
  maxLength,
  tooltip,
  editRequest = 0,
  children,
}: {
  value: string;
  onSave: (value: string) => void;
  onCancel?: () => void;
  onDismiss?: (value: string) => void;
  onEditingChange?: (editing: boolean) => void;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  autoSize?: boolean;
  maxLength?: number;
  tooltip?: string;
  editRequest?: number;
  children?: ReactNode;
}) {
  const { t } = useTranslation("notebooks");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [truncated, setTruncated] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (editRequest > 0) setEditing(true);
  }, [editRequest]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useLayoutEffect(() => {
    if (editing || !tooltip) {
      setTruncated(false);
      return;
    }
    const element = buttonRef.current;
    if (!element) return;
    const measure = () => setTruncated(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [editing, tooltip, value]);

  function finish() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== value) onSave(next);
    else {
      setDraft(value);
      onDismiss?.(next);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraft(value);
      setEditing(false);
      onCancel?.();
    }
    if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      finish();
    }
  }

  if (editing) {
    const assignRef = (node: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputRef.current = node;
    };
    const shared = {
      value: draft,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
      onBlur: finish,
      onKeyDown: handleKeyDown,
      onPointerDown: (event: PointerEvent<HTMLInputElement | HTMLTextAreaElement>) => event.stopPropagation(),
      onDoubleClick: (event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => event.stopPropagation(),
      maxLength,
      className: cn("library-inline-editable__input", inputClassName),
      "aria-label": ariaLabel,
    };
    return multiline ? <textarea {...shared} ref={assignRef} rows={3} /> : autoSize ? (
      <span className="library-inline-editable__sizer">
        <span aria-hidden="true">{draft || "\u00a0"}</span>
        <input {...shared} ref={assignRef} size={1} />
      </span>
    ) : (
      <input {...shared} ref={assignRef} />
    );
  }

  const button = (
    <button
      ref={buttonRef}
      type="button"
      className={cn("library-inline-editable", className)}
      onClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      aria-label={t("library.editAria", { label: ariaLabel })}
    >
      {children ?? value}
    </button>
  );

  if (!tooltip || !truncated) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
