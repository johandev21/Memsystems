import { memo, useMemo } from "react";

export interface HighlightMatchProps {
  text: string;
  query?: string;
  className?: string;
  highlightClassName?: string;
}

export const HighlightMatch = memo(function HighlightMatch({
  text,
  query,
  className,
  highlightClassName = "bg-primary/20 text-foreground font-semibold rounded-xs px-0.5",
}: HighlightMatchProps) {
  const parts = useMemo(() => {
    if (!query || !query.trim()) {
      return null;
    }
    const cleanQuery = query.trim();
    const regex = new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.split(regex);
  }, [text, query]);

  if (!parts) {
    return <span className={className}>{text}</span>;
  }

  const cleanQueryLower = query?.trim().toLowerCase();

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === cleanQueryLower ? (
          <mark key={index} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
});
