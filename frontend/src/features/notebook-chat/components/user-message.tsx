import type { UIMessage } from "@ai-sdk/react";
import { useTranslation } from "react-i18next";
import { Message, MessageContent, MessageResponse } from "@/features/ai";

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
}

export function UserMessage({ message }: UserMessageProps) {
  const { t } = useTranslation("chat");
  const textParts = message.parts.filter(isTextPart);
  const fileParts = message.parts.filter(isFilePart);

  return (
    <Message className="[content-visibility:auto] [contain-intrinsic-size:auto_60px]" from="user">
      <span className="sr-only">{t("sender.user")}</span>
      <MessageContent className="px-3.5 py-2.5 text-sm leading-relaxed sm:px-4 sm:py-3 break-words [overflow-wrap:anywhere]">
        {fileParts.map((file, index) => {
          if (file.mediaType?.startsWith("image/")) {
            return (
              <div
                key={`${message.id}-file-${index}`}
                className="relative overflow-hidden rounded-xl border border-primary-foreground/20 shadow-xs max-w-xs mb-1"
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
        {textParts.map((part, index) => (
          <MessageResponse key={`${message.id}-${index}`} className="break-words [overflow-wrap:anywhere]">
            {part.text}
          </MessageResponse>
        ))}
      </MessageContent>
    </Message>
  );
}
