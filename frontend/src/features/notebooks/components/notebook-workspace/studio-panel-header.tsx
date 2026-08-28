import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StudioPanelHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function StudioPanelHeader({ collapsed, onToggleCollapse }: StudioPanelHeaderProps) {
  return (
    <header className="flex items-center justify-between p-1.5 bg-panel-header-bg">
      <h2 className={`text-sm font-semibold ${collapsed ? "hidden" : ""}`}>Studio</h2>
      <Button
        variant="ghost"
        size="icon"
        className={collapsed ? "mx-auto cursor-pointer" : "cursor-pointer"}
        aria-label={collapsed ? "Expand studio" : "Collapse studio"}
        onClick={onToggleCollapse}
      >
        {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
      </Button>
    </header>
  );
}
