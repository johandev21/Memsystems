import { Badge } from "@/components/ui/badge";
import { Presentation } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface PptxViewerHeaderProps {
  title: string;
  totalSlides: number;
}

export function PptxViewerHeader({ title, totalSlides }: PptxViewerHeaderProps) {
  const { t } = useTranslation("sourceRenderers");
  return (
    <div className="shrink-0 border-b border-border/60 bg-card/60 backdrop-blur-md px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground shrink-0">
            <Presentation className="size-3 text-primary" />
            {t("pptxHeader.presentation")}
          </Badge>
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <Badge variant="secondary" className="font-normal text-xs shrink-0">
          {t("pptxHeader.slideCount", { count: totalSlides })}
        </Badge>
      </div>
    </div>
  );
}
