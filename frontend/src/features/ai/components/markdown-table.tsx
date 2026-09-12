import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

export interface MarkdownTableProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Scroll container for markdown tables.
 *
 * `react-markdown` renders a bare `<table>`. Without a wrapper the wide
 * table is squeezed to `max-width: 100%` and clipped by the
 * `overflow-hidden` ancestors (`MessageContent`, `MessageBranchContent`).
 * The wrapper constrains itself to the message width and scrolls
 * horizontally only when the table's min content exceeds it.
 * The inner table uses `width: 100%` (not `max-content`) so narrow tables
 * with long cells wrap instead of forcing a scroll.
 */
export function MarkdownTable({ children, className }: MarkdownTableProps) {
  const { t } = useTranslation("ai");

  return (
    <div
      className={cn("markdown-table-wrapper", className)}
      tabIndex={0}
      role="region"
      aria-label={t("markdownTable.ariaLabel")}
    >
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}
