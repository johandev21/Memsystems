import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}

export function SectionHeader({
  title,
  viewAllHref,
  viewAllLabel = "View all",
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {viewAllHref && (
        <Link
          to={viewAllHref}
          className="inline-flex items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {viewAllLabel}
          <ArrowUpRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
