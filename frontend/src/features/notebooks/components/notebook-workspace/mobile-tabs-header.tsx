import { BookOpen, MessageSquare, Sparkles } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotebookSettingsDialog } from "../dialogs/notebook-settings-dialog";

export interface MobileTabsHeaderProps {
  notebookId: string;
}

export function MobileTabsHeader({ notebookId }: MobileTabsHeaderProps) {
  return (
    <div className="shrink-0 px-3 pt-2 pb-1.5">
      <div className="flex items-center justify-end mb-2">
        <span className="sr-only">Notebook sections</span>
        <NotebookSettingsDialog notebookId={notebookId} />
      </div>
      <TabsList className="w-full !h-auto bg-muted/50 p-1 grid grid-cols-3 gap-0">
        <TabsTrigger
          value="sources"
          className="gap-1.5 py-2 text-sm font-medium transition-colors duration-200 data-active:bg-card data-active:shadow-sm data-active:border data-active:border-border/40 cursor-pointer"
        >
          <BookOpen className="size-4" />
          Sources
        </TabsTrigger>
        <TabsTrigger
          value="chat"
          className="gap-1.5 py-2 text-sm font-medium transition-colors duration-200 data-active:bg-card data-active:shadow-sm data-active:border data-active:border-border/40 cursor-pointer"
        >
          <MessageSquare className="size-4" />
          Chat
        </TabsTrigger>
        <TabsTrigger
          value="studio"
          className="gap-1.5 py-2 text-sm font-medium transition-colors duration-200 data-active:bg-card data-active:shadow-sm data-active:border data-active:border-border/40 cursor-pointer"
        >
          <Sparkles className="size-4" />
          Studio
        </TabsTrigger>
      </TabsList>
    </div>
  );
}
