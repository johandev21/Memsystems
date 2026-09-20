import { AlertTriangle, Eye, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/ui/markdown";
import { cn } from "@/shared/utils/cn";
import type { ParsedImageSection } from "./image-types";

export interface ImageNoteCardProps {
  section: ParsedImageSection;
  isActive: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  noteRefs: React.RefObject<Map<string, HTMLDivElement>>;
}

export function ImageNoteCard({
  section,
  isActive,
  isHovered,
  onHover,
  onSelect,
  noteRefs,
}: ImageNoteCardProps) {
  const { t } = useTranslation("sourceRenderers");
  const hasRegion = Boolean(section.locator?.imageRegion);
  return (
    <div
      ref={(el) => {
        if (el) noteRefs.current.set(section.id, el);
        else noteRefs.current.delete(section.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(section.id);
        }
      }}
      onMouseEnter={() => onHover(section.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(section.id)}
      className={cn(
        "group rounded-xl border p-3.5 transition-all cursor-pointer",
        isActive
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs"
          : isHovered
            ? "border-primary/50 bg-muted/40"
            : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">#{section.ordinal}</span>

          {section.kind === "visual_description" && (
            <Badge
              variant="secondary"
              className="gap-1 bg-primary/10 text-primary border-primary/20 text-xs"
            >
              <Eye className="size-3" />
              {t("imageNote.visualDescription")}
            </Badge>
          )}

          {section.kind === "formula" && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t("imageNote.formula")}
            </Badge>
          )}

          {section.kind === "heading" && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {t("imageNote.heading")}
            </Badge>
          )}
        </div>

        {hasRegion && (
          <span className="text-xs text-muted-foreground group-hover:text-primary flex items-center gap-0.5 transition-colors">
            <Layers className="size-3" />
            {t("imageNote.regionLabel", { ordinal: section.ordinal })}
          </span>
        )}
      </div>

      <div className="max-w-none text-sm leading-relaxed">
        {section.kind === "heading" ? (
          <h3 className="font-bold text-foreground text-base tracking-tight my-1">
            {section.content.replace(/^#{1,6}\s+/, "")}
          </h3>
        ) : (
          <MarkdownRenderer>{section.content}</MarkdownRenderer>
        )}
      </div>

      {section.warning && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="size-3" />
          <span>{section.warning}</span>
        </div>
      )}
    </div>
  );
}
