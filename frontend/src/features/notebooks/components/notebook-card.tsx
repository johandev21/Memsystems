import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/cn";
import { chatMessagesQueryOptions } from "@/features/notebook-chat/api/chat";
import { notebookQueryOptions } from "../api";
import { buildBannerSrcSet } from "../utils/banner-variants";

interface NotebookCardProps {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
  imageUrl?: string;
  bannerVariants?: { w480: string | null; w960: string | null; w1920: string | null } | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  icon: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function NotebookCard({
  id,
  title,
  description,
  updatedAt,
  imageUrl,
  bannerVariants,
  bannerFocalPoint,
  icon,
  className,
  style,
}: NotebookCardProps) {
  const [isBannerLoaded, setIsBannerLoaded] = useState(false);
  const queryClient = useQueryClient();

  // Warm the notebook + chat history caches on intent so opening a notebook
  // renders its banner and messages immediately instead of waiting on a
  // request waterfall.
  const prefetch = useCallback(() => {
    void queryClient.prefetchQuery(notebookQueryOptions(id));
    void queryClient.prefetchQuery(chatMessagesQueryOptions(id));
  }, [id, queryClient]);

  return (
    <Link
      to="/notebooks/$notebookId"
      params={{ notebookId: id }}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className={cn(
        "group relative flex flex-col overflow-hidden bg-card ring-1 ring-foreground/10 hover:ring-primary/35 hover:shadow-md transition-all duration-200 cursor-pointer block rounded-panel",
        className,
      )}
      style={style}
    >
      <div className="relative h-36 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            srcSet={buildBannerSrcSet(bannerVariants)}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            alt={title}
            className={cn(
              "h-full w-full bg-muted object-cover object-(--banner-pos) transition-opacity duration-300 group-hover:opacity-100",
              isBannerLoaded ? "opacity-60" : "opacity-0",
            )}
            style={
              {
                "--banner-pos": `${Math.round((bannerFocalPoint?.x ?? 0.5) * 100)}% ${Math.round((bannerFocalPoint?.y ?? 0.5) * 100)}%`,
              } as React.CSSProperties
            }
            ref={(el) => {
              if (el?.complete && el.naturalWidth > 0) setIsBannerLoaded(true);
            }}
            onLoad={() => setIsBannerLoaded(true)}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted" />
        )}
      </div>
      <div className="absolute left-4 top-36 flex size-14 -translate-y-1/2 items-center justify-center z-10 drop-shadow-sm [&_svg]:size-full">
        {icon}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4 pt-8">
        <h3 className="font-heading text-base font-medium text-foreground">{title}</h3>
        <p className="line-clamp-2 text-sm text-foreground/75">{description}</p>
      </div>
      <div className="flex items-center px-4 pb-4 text-xs text-muted-foreground">
        <span>{updatedAt}</span>
      </div>
    </Link>
  );
}
