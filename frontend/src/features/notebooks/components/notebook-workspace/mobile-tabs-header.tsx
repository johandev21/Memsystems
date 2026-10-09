import { BookOpen, MessageSquare, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface MobileTabsHeaderProps {
  notebookId?: string;
}

export function MobileTabsHeader({ notebookId: _notebookId }: MobileTabsHeaderProps = {}) {
  const { t } = useTranslation("notebooks");

  return (
    <div className="shrink-0 px-3 pt-2 pb-1.5">
      <TabsList className="w-full !h-auto bg-muted/50 p-1 grid grid-cols-3 gap-0 rounded-2xl">
        <TabsTrigger
          value="sources"
          className="gap-1.5 py-2 text-xs sm:text-sm font-medium transition-transform transition-colors duration-150 data-active:bg-card data-active:shadow-xs data-active:border data-active:border-border/40 cursor-pointer touch-manipulation active:scale-97 select-none"
        >
          <BookOpen className="size-4 shrink-0" />
          <span className="truncate">{t("panels.sources")}</span>
        </TabsTrigger>
        <TabsTrigger
          value="chat"
          className="gap-1.5 py-2 text-xs sm:text-sm font-medium transition-transform transition-colors duration-150 data-active:bg-card data-active:shadow-xs data-active:border data-active:border-border/40 cursor-pointer touch-manipulation active:scale-97 select-none"
        >
          <MessageSquare className="size-4 shrink-0" />
          <span className="truncate">{t("panels.chat")}</span>
        </TabsTrigger>
        <TabsTrigger
          value="studio"
          className="gap-1.5 py-2 text-xs sm:text-sm font-medium transition-transform transition-colors duration-150 data-active:bg-card data-active:shadow-xs data-active:border data-active:border-border/40 cursor-pointer touch-manipulation active:scale-97 select-none"
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="truncate">{t("panels.studio")}</span>
        </TabsTrigger>
      </TabsList>
    </div>
  );
}
