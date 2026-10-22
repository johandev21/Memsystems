import type { UIMessage } from "@ai-sdk/react";
import { Check, ChevronLeft, ChevronRight, Copy, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Message, MessageContent, MessageResponse } from "@/features/ai";
import { cn } from "@/shared/utils/cn";

type TextPart = { type: "text"; text: string; state?: "streaming" | "done" };
type FilePart = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
};

const isTextPart = (part: UIMessage["parts"][number]): part is TextPart => {
  return part.type === "text";
};

const isFilePart = (part: UIMessage["parts"][number]): part is FilePart => {
  return part.type === "file" && typeof (part as FilePart).url === "string";
};

export interface UserMessageProps {
  message: UIMessage;
  siblingMessages?: UIMessage[];
  disabled?: boolean;
  onEdit?: (message: UIMessage, text: string) => void;
  onCopy?: (text: string) => void | boolean | Promise<void | boolean>;
  onSelectBranch?: (messageId: string) => void;
}

export function UserMessage({ message, siblingMessages = [], disabled = false, onEdit, onCopy, onSelectBranch }: UserMessageProps) {
  const { t } = useTranslation("chat");
  const textParts = message.parts.filter(isTextPart);
  const fileParts = message.parts.filter(isFilePart);
  const text = textParts.map((part) => part.text).join("\n\n");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [copied, setCopied] = useState(false);
  const peers = siblingMessages.length ? siblingMessages : [message];
  const activeIndex = Math.max(0, peers.findIndex((item) => item.id === message.id));

  const save = () => {
    if (disabled) return;
    const nextText = draft.trim();
    if (!nextText || nextText === text.trim()) {
      setEditing(false);
      return;
    }
    onEdit?.(message, nextText);
    setEditing(false);
  };
  const copy = async () => {
    if (!onCopy) return;
    const content = text || fileParts.map((file) => file.filename || t("composer.attachmentAlt")).join("\n");
    const succeeded = await onCopy(content);
    if (succeeded !== false) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <Message className={cn("[content-visibility:auto] [contain-intrinsic-size:auto_60px]", editing && "max-w-full")} from="user">
      <span className="sr-only">{t("sender.user")}</span>
      <MessageContent className={cn(
        "px-3.5 py-2.5 text-sm leading-relaxed sm:px-4 sm:py-3 break-words [overflow-wrap:anywhere]",
        editing && "!ml-0 !w-full !max-w-full !rounded-xl !border !border-border !bg-surface-1 !px-3 !py-3 !text-foreground focus-within:border-ring",
      )}>
        {fileParts.map((file, index) => {
          if (file.mediaType?.startsWith("image/")) {
            return (
              <div
                key={`${message.id}-file-${index}`}
                className={cn(
                  "relative mb-1 max-w-xs overflow-hidden rounded-xl border shadow-xs",
                  editing ? "border-border" : "border-primary-foreground/20",
                )}
              >
                <img
                  src={file.url}
                  alt={file.filename || t("userMessage.attachedImageAlt")}
                  className="max-h-60 w-auto rounded-xl object-contain"
                />
              </div>
            );
          }
          return null;
        })}
        {editing ? (
          <div className="w-full min-w-0">
            {fileParts.length > 0 && <p className="mb-2 text-xs text-muted-foreground">{t("edit.attachmentsUnchanged", { count: fileParts.length })}</p>}
            <Textarea
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  setEditing(false);
                  setDraft(text);
                }
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  save();
                }
              }}
              aria-label={t("edit.editorLabel")}
              rows={2}
              className="max-h-60 min-h-20 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-1 leading-relaxed shadow-none outline-none ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
            />
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(text); }}>{t("edit.cancel")}</Button>
              <Button type="button" size="sm" onClick={save} disabled={disabled || !draft.trim() || draft.trim() === text.trim()}>{t("edit.send")}</Button>
            </div>
          </div>
        ) : textParts.map((part, index) => (
          <MessageResponse key={`${message.id}-${index}`} className="break-words [overflow-wrap:anywhere]">
            {part.text}
          </MessageResponse>
        ))}
      </MessageContent>
      {!editing && <div className="mt-1 flex flex-wrap items-center justify-end gap-1 text-text-tertiary">
        {peers.length > 1 && <>
          <UserMessageAction label={t("assistant.previousVersion")} disabled={disabled || activeIndex === 0} onClick={() => onSelectBranch?.(peers[activeIndex - 1].id)}><ChevronLeft className="size-3.5" /></UserMessageAction>
          <span className="min-w-13 text-center text-xs">{t("assistant.branchPage", { current: activeIndex + 1, total: peers.length })}</span>
          <UserMessageAction label={t("assistant.nextVersion")} disabled={disabled || activeIndex === peers.length - 1} onClick={() => onSelectBranch?.(peers[activeIndex + 1].id)}><ChevronRight className="size-3.5" /></UserMessageAction>
        </>}
        {(text || fileParts.length > 0) && <UserMessageAction label={t("assistant.copyMessage")} onClick={() => void copy()}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</UserMessageAction>}
        {onEdit && <UserMessageAction label={t("edit.editMessage")} disabled={disabled} onClick={() => { setDraft(text); setEditing(true); }}><Pencil className="size-3.5" /></UserMessageAction>}
      </div>}
    </Message>
  );
}

interface UserMessageActionProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}

function UserMessageAction({ label, onClick, children, disabled = false }: UserMessageActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="max-sm:min-h-11 max-sm:min-w-11 rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary active:scale-97 touch-manipulation"
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
