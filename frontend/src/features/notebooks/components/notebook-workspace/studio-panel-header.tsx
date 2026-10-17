import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface StudioPanelHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function StudioPanelHeader({
  collapsed,
  onToggleCollapse,
}: StudioPanelHeaderProps) {
  const { t } = useTranslation("notebooks");

  return (
    <header className="flex items-center justify-between p-1.5 bg-panel-header-bg min-h-11">
      <h2 className={`text-sm font-semibold pl-1.5 ${collapsed ? "hidden" : ""}`}>
        {t("panels.studio")}
      </h2>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={collapsed ? "mx-auto cursor-pointer" : "h-7 w-7 cursor-pointer active:scale-97 transition-transform touch-manipulation"}
          aria-label={collapsed ? t("panels.expandStudio") : t("panels.collapseStudio")}
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
