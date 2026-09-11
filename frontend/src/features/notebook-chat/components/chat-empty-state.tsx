import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConversationEmptyState } from "@/features/ai";

export interface ChatEmptyStateProps {
  notebookTitle: string;
  description: string | null;
  isUntitled: boolean;
}

export function ChatEmptyState({ notebookTitle, description, isUntitled }: ChatEmptyStateProps) {
  const { t } = useTranslation("chat");

  if (isUntitled) {
    return (
      <ConversationEmptyState
        title={t("empty.blankCanvas")}
        icon={<MessageSquare className="size-8" />}
      />
    );
  }

  if (description?.trim()) {
    return null;
  }

  return (
    <ConversationEmptyState
      title={t("empty.welcomeTitle", { title: notebookTitle })}
      description={t("empty.welcomeDescription")}
    />
  );
}
