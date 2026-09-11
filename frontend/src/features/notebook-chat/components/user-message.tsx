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

export function UserMessage({ message }: { message: UIMessage }) {
  const { t } = useTranslation("chat");
  const textParts = message.parts.filter(isTextPart);
  const fileParts = message.parts.filter(isFilePart);

  return (
    <Message from="user">
      <MessageContent>
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
          <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse>
        ))}
      </MessageContent>
    </Message>
  );
}
