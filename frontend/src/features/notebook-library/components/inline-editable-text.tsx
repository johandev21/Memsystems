import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InlineEditableInputProps {
  value: string;
  multiline?: boolean;
  autoSize?: boolean;
  maxLength?: number;
  className?: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function InlineEditableInput({
  value,
  multiline = false,
  autoSize = false,
  maxLength,
  className,
  ariaLabel,
  onCommit,
  onCancel,
}: InlineEditableInputProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      onCommit(draft.trim());
    }
  };

  const assignRef = (node: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRef.current = node;
  };

  const shared = {
    value: draft,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: () => onCommit(draft.trim()),
    onKeyDown: handleKeyDown,
    onPointerDown: (event: PointerEvent<HTMLInputElement | HTMLTextAreaElement>) => event.stopPropagation(),
    onDoubleClick: (event: MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => event.stopPropagation(),
    maxLength,
    className: cn(className || "library-inline-editable__input"),
    "aria-label": ariaLabel,
  };

  if (multiline) {
    return <textarea {...shared} ref={assignRef} rows={3} />;
  }

  if (autoSize) {
    return (
      <span className="library-inline-editable__sizer">
        <span aria-hidden="true">{draft || "\u00a0"}</span>
        <input {...shared} ref={assignRef} size={1} />
      </span>
    );
  }

  return <input {...shared} ref={assignRef} />;
}

interface InlineEditableDisplayProps {
  value: string;
  className?: string;
  ariaLabel: string;
  tooltip?: string;
  onStartEditing: () => void;
  children?: ReactNode;
}

function InlineEditableDisplay({
  value,
  className,
  ariaLabel,
  tooltip,
  onStartEditing,
  children,
}: InlineEditableDisplayProps) {
  const { t } = useTranslation("notebooks");
  const [truncated, setTruncated] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!tooltip) return;
    const element = buttonRef.current;
    if (!element) return;
    const measure = () => setTruncated(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tooltip, value]);

  const button = (
    <button
      ref={buttonRef}
      type="button"
      className={cn("library-inline-editable", className)}
      onClick={(event) => {
        event.stopPropagation();
        onStartEditing();
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

export interface InlineEditableTextProps {
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
}

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
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(editRequest > 0);
  const [prevEditRequest, setPrevEditRequest] = useState(editRequest);

  if (editRequest !== prevEditRequest) {
    setPrevEditRequest(editRequest);
    if (editRequest > 0 && !editing) {
      setEditing(true);
    }
  }

  const handleStartEditing = () => {
    setEditing(true);
    onEditingChange?.(true);
  };

  const handleCommit = (next: string) => {
    setEditing(false);
    onEditingChange?.(false);
    if (next && next !== value) {
      onSave(next);
    } else {
      onDismiss?.(next);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    onEditingChange?.(false);
    onCancel?.();
  };

  if (editing) {
    return (
      <InlineEditableInput
        value={value}
        multiline={multiline}
        autoSize={autoSize}
        maxLength={maxLength}
        className={inputClassName}
        ariaLabel={ariaLabel}
        onCommit={handleCommit}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <InlineEditableDisplay
      value={value}
      className={className}
      ariaLabel={ariaLabel}
      tooltip={tooltip}
      onStartEditing={handleStartEditing}
    >
      {children}
    </InlineEditableDisplay>
  );
}

