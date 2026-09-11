import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface StudioPanelHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function StudioPanelHeader({ collapsed, onToggleCollapse }: StudioPanelHeaderProps) {
  const { t } = useTranslation("notebooks");

  return (
    <header className="flex items-center justify-between p-1.5 bg-panel-header-bg">
      <h2 className={`text-sm font-semibold ${collapsed ? "hidden" : ""}`}>{t("panels.studio")}</h2>
      <Button
        variant="ghost"
        size="icon"
        className={collapsed ? "mx-auto cursor-pointer" : "cursor-pointer"}
        aria-label={collapsed ? t("panels.expandStudio") : t("panels.collapseStudio")}
        onClick={onToggleCollapse}
      >
        {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
      </Button>
    </header>
  );
}
