import { CheckSquare, PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";

export interface StudioPanelHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  isMultiselectMode?: boolean;
  onToggleMultiselect?: () => void;
}

export function StudioPanelHeader({
  collapsed,
  onToggleCollapse,
  isSearchOpen,
  onToggleSearch,
  isMultiselectMode,
  onToggleMultiselect,
}: StudioPanelHeaderProps) {
  const { t } = useTranslation("notebooks");

  return (
    <header className="flex items-center justify-between p-1.5 bg-panel-header-bg min-h-11">
      <h2 className={`text-sm font-semibold pl-1.5 ${collapsed ? "hidden" : ""}`}>
        {t("panels.studio")}
      </h2>
      <div className="flex items-center gap-0.5">
        {!collapsed && (
          <>
            {onToggleSearch && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 cursor-pointer active:scale-97 transition-transform touch-manipulation",
                        isSearchOpen && "bg-accent text-accent-foreground font-semibold",
                      )}
                      aria-label="Search study materials"
                      onClick={onToggleSearch}
                    >
                      <Search className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>Search study materials</TooltipContent>
              </Tooltip>
            )}

            {onToggleMultiselect && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 cursor-pointer active:scale-97 transition-transform touch-manipulation",
                        isMultiselectMode && "bg-accent text-accent-foreground font-semibold",
                      )}
                      aria-label="Select multiple study materials"
                      onClick={onToggleMultiselect}
                    >
                      <CheckSquare className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>Select multiple</TooltipContent>
              </Tooltip>
            )}
          </>
        )}

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
