import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { AddSourceDialog } from "@/features/sources";
import { cn } from "@/shared/utils/cn";

export interface SourcesPanelHeaderProps {
  collapsed: boolean;
  notebookId: string;
  onToggleCollapse: () => void;
}

export function SourcesPanelHeader({
  collapsed,
  notebookId,
  onToggleCollapse,
}: SourcesPanelHeaderProps) {
  return (
    <header className="flex items-center justify-between p-1.5 bg-panel-header-bg min-h-[44px]">
      <h2 className={`text-sm font-semibold pl-1.5 ${collapsed ? "hidden" : ""}`}>Sources</h2>
      <div className="flex items-center gap-0.5">
        {!collapsed && (
          <AddSourceDialog notebookId={notebookId}>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-7 w-7 cursor-pointer",
              )}
              aria-label="Add source"
            >
              <Plus className="size-4" />
            </button>
          </AddSourceDialog>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={collapsed ? "mx-auto cursor-pointer" : "h-7 w-7 cursor-pointer"}
          aria-label={collapsed ? "Expand sources" : "Collapse sources"}
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
