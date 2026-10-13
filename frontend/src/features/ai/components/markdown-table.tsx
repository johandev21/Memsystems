import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";

export interface MarkdownTableProps {
  children?: ReactNode;
  className?: string;
}

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
