import { useTranslation } from "react-i18next";
import { NotebookSettingsDialog } from "@/features/notebooks/components/dialogs/notebook-settings-dialog";

interface ChatPanelHeaderProps {
  notebookId: string;
}

export function ChatPanelHeader({ notebookId }: ChatPanelHeaderProps) {
  const { t } = useTranslation("chat");

  return (
    <header className="flex items-center justify-between p-1.5 bg-panel-header-bg min-h-11">
      <h2 className="text-sm font-semibold">{t("header.title")}</h2>
      <NotebookSettingsDialog notebookId={notebookId} />
    </header>
  );
}
