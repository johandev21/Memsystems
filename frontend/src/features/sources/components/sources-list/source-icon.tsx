import { useMemo, useState } from "react";
import type React from "react";
import { cn } from "@/shared/utils/cn";
import type { Source } from "../../api/sources";
import { getFaviconUrl } from "./source-icon-utils";
import { MarkdownIcon } from "./markdown-icon";

export interface SourceFaviconProps {
  url?: string | null;
  title?: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function SourceFavicon({
  url,
  title,
  className,
  fallback = null,
}: SourceFaviconProps) {
  const faviconUrl = useMemo(() => getFaviconUrl(url), [url]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasError = failedUrl === faviconUrl;

  if (!faviconUrl || hasError) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={faviconUrl}
      alt={title ? "" : ""}
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailedUrl(faviconUrl)}
      className={cn("rounded-xs object-contain", className)}
    />
  );
}

export interface SourceIconProps {
  source: Source;
  className?: string;
}

export function SourceIcon({ className }: SourceIconProps) {
  return <MarkdownIcon className={className} />;
}
