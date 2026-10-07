import { createElement, useMemo, useState } from "react";
import type React from "react";
import { Link2, Video } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import type { Source } from "../../api/sources";
import { isYouTubeUrl } from "../../utils/detect-document-type";
import { getFaviconUrl, getSourceIcon } from "./source-icon-utils";

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

export function SourceIcon({ source, className }: SourceIconProps) {
  if (source.kind === "url" && source.url) {
    const isYoutube = isYouTubeUrl(source.url);
    const FallbackIcon = isYoutube ? Video : Link2;

    return (
      <SourceFavicon
        url={source.url}
        title={source.title}
        className={className}
        fallback={
          <FallbackIcon
            className={className}
            strokeWidth={1.7}
          />
        }
      />
    );
  }

  return createElement(getSourceIcon(source), {
    className,
    strokeWidth: 1.7,
  });
}
