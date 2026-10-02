import {
  BookOpen,
  Check,
  Copy,
  ExternalLinkIcon,
  File,
  FileText,
  Globe,
  Headphones,
  ImageIcon,
  Presentation,
  Video,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  getCitationExcerpt,
  getCitationLocatorLabel,
  getSafeCitationUrl,
  type CitationReference,
} from "@/shared/citations/citation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  notifyCitationClosed,
  notifyCitationOpened,
  useIsAnyOtherCitationActive,
} from "@/shared/citations/citation-hover-group";
import { useIsTouchDevice } from "@/shared/citations/use-touch-device";

function CitationKindIcon({
  kind,
  url,
  className,
}: {
  kind?: string | null;
  url?: string | null;
  className?: string;
}) {
  const normalized = (kind ?? "").toLowerCase();
  const isYoutube = Boolean(url && /youtube\.com|youtu\.be/i.test(url));

  if (normalized === "video" || isYoutube) return <Video className={className} aria-hidden="true" />;
  if (normalized === "audio") return <Headphones className={className} aria-hidden="true" />;
  if (normalized === "image") return <ImageIcon className={className} aria-hidden="true" />;
  if (normalized === "slides" || normalized === "presentation") return <Presentation className={className} aria-hidden="true" />;
  if (normalized === "ebook" || normalized === "epub") return <BookOpen className={className} aria-hidden="true" />;
  if (normalized === "url" || normalized === "web") return <Globe className={className} aria-hidden="true" />;
  if (normalized === "pdf" || normalized === "file" || normalized === "document") return <FileText className={className} aria-hidden="true" />;
  return <File className={className} aria-hidden="true" />;
}

export function CitationEvidenceBody({ reference }: { reference: CitationReference }) {
  const context = reference.context?.trim();
  const quote = reference.quote?.trim();

  if (context && quote) {
    const quoteIndex = context.indexOf(quote);
    if (quoteIndex !== -1) {
      const before = context.slice(0, quoteIndex);
      const matched = context.slice(quoteIndex, quoteIndex + quote.length);
      const after = context.slice(quoteIndex + quote.length);

      return (
        <div
          data-slot="citation-evidence"
          className="max-h-56 overflow-y-auto text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap select-text pr-1"
        >
          {before}
          <mark className="rounded-xs bg-primary/15 px-0.5 font-medium text-foreground dark:bg-primary/25">
            {matched}
          </mark>
          {after}
        </div>
      );
    }

    return (
      <div
        data-slot="citation-evidence"
        className="max-h-56 overflow-y-auto space-y-1.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap select-text pr-1"
      >
        <p>
          <mark className="rounded-xs bg-primary/15 px-0.5 font-medium text-foreground dark:bg-primary/25">
            {quote}
          </mark>
        </p>
        <p className="text-xs opacity-80">{context}</p>
      </div>
    );
  }

  const excerpt = getCitationExcerpt(reference);
  return (
    <div
      data-slot="citation-evidence"
      className="max-h-56 overflow-y-auto text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap select-text pr-1"
    >
      {quote ? (
        <mark className="rounded-xs bg-primary/15 px-0.5 font-medium text-foreground dark:bg-primary/25">
          {excerpt}
        </mark>
      ) : (
        excerpt
      )}
    </div>
  );
}

export function CitationCardHeader({
  reference,
  locatorLabel,
}: {
  reference: CitationReference;
  locatorLabel: string | null;
}) {
  const { t } = useTranslation("chat");

  return (
    <div className="space-y-1.5 pb-2 border-b border-border/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CitationKindIcon
            kind={reference.kind}
            url={reference.url}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <h4 className="text-xs font-semibold text-foreground truncate">{reference.title}</h4>
        </div>
        {!reference.isAvailable && (
          <Badge variant="outline" className="text-xs px-1 py-0 h-4 shrink-0">
            {t("referencePopover.sourceUnavailable")}
          </Badge>
        )}
      </div>

      {reference.sectionPath && reference.sectionPath.length > 0 && (
        <div
          data-slot="citation-breadcrumbs"
          data-testid="citation-breadcrumbs"
          className="flex items-center gap-1 text-xs text-muted-foreground/80 truncate font-mono"
        >
          {reference.sectionPath.join(" > ")}
        </div>
      )}

      {locatorLabel && (
        <div className="text-xs font-medium text-muted-foreground">
          {locatorLabel}
        </div>
      )}
    </div>
  );
}

export function CitationActions({
  reference,
  safeUrl,
}: {
  reference: CitationReference;
  safeUrl: string | null;
}) {
  const { t } = useTranslation("chat");
  const [copied, setCopied] = useState(false);

  const quoteToCopy = reference.quote?.trim() || reference.description?.trim();

  const handleCopy = async () => {
    if (!quoteToCopy) return;
    try {
      await navigator.clipboard.writeText(quoteToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleOpenSourceViewer = () => {
    window.dispatchEvent(
      new CustomEvent("open-source-viewer", {
        detail: {
          sourceId: reference.id,
          locator: reference.locator,
        },
      }),
    );
  };

  const hasInAppViewer = Boolean(
    reference.isAvailable &&
      (reference.locator?.imageRegion ||
        typeof reference.locator?.startOffsetMs === "number" ||
        typeof reference.locator?.slideNumber === "number" ||
        reference.locator?.symbol ||
        reference.locator?.cellRange ||
        reference.locator?.sheetName ||
        !safeUrl ||
        reference.id),
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-1 pt-2 border-t border-border/40">
      {quoteToCopy && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="cursor-pointer gap-1 text-xs h-7"
          onClick={handleCopy}
          aria-label={copied ? t("referencePopover.quoteCopied") : t("referencePopover.copyQuote")}
        >
          {copied ? (
            <>
              <Check className="size-3 text-primary" data-icon="inline-start" />
              <span>{t("referencePopover.quoteCopied")}</span>
            </>
          ) : (
            <>
              <Copy className="size-3" data-icon="inline-start" />
              <span>{t("referencePopover.copyQuote")}</span>
            </>
          )}
        </Button>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {hasInAppViewer && reference.id && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="cursor-pointer gap-1 text-xs h-7"
            onClick={handleOpenSourceViewer}
          >
            {t("referencePopover.openSource")}
          </Button>
        )}

        {safeUrl && (
          <Button
            render={
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("referencePopover.openExternal")}
              >
                {t("referencePopover.openExternal")}
                <ExternalLinkIcon className="size-3" data-icon="inline-end" />
              </a>
            }
            nativeButton={false}
            size="xs"
            variant="ghost"
            className="cursor-pointer gap-1 text-xs h-7"
          />
        )}
      </div>
    </div>
  );
}

export interface CitationHoverCardProps {
  reference: CitationReference;
  children?: ReactNode;
  forceDrawer?: boolean;
}

export function CitationHoverCard({
  reference,
  children,
  forceDrawer,
}: CitationHoverCardProps) {
  const { t } = useTranslation("chat");
  const isTouchDevice = useIsTouchDevice();
  const isTouch = forceDrawer ?? isTouchDevice;
  const safeUrl = getSafeCitationUrl(reference.url);
  const locatorLabel = getCitationLocatorLabel(reference);

  const referenceKey = reference.id || reference.citationKey || String(reference.number);
  const isGroupActive = useIsAnyOtherCitationActive(referenceKey);
  const delay = isGroupActive ? 0 : 250;

  if (isTouch) {
    return (
      <Drawer>
        <DrawerTrigger
          render={
            <Button
              type="button"
              size="icon-xs"
              variant="secondary"
              aria-label={t("referencePopover.triggerAria", {
                number: reference.number,
                title: reference.title,
              })}
              className="relative -top-px mx-0.5 inline-flex h-5 w-auto min-w-5 rounded-full px-1 align-baseline text-xs leading-none text-muted-foreground hover:text-foreground"
            />
          }
        >
          {children ?? reference.number}
        </DrawerTrigger>

        <DrawerContent
          data-slot="citation-bottom-sheet"
          className="space-y-3"
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>{reference.title}</DrawerTitle>
            <DrawerDescription>{reference.quote ?? reference.title}</DrawerDescription>
          </DrawerHeader>

          <CitationCardHeader reference={reference} locatorLabel={locatorLabel} />
          <CitationEvidenceBody reference={reference} />
          <CitationActions reference={reference} safeUrl={safeUrl} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <HoverCard
      onOpenChange={(open) => {
        if (open) {
          notifyCitationOpened(referenceKey);
        } else {
          notifyCitationClosed(referenceKey);
        }
      }}
    >
      <HoverCardTrigger
        delay={delay}
        closeDelay={200}
        render={
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            aria-label={t("referencePopover.triggerAria", {
              number: reference.number,
              title: reference.title,
            })}
            className="relative -top-px mx-0.5 inline-flex h-5 w-auto min-w-5 rounded-full px-1 align-baseline text-xs leading-none text-muted-foreground hover:text-foreground"
          />
        }
      >
        {children ?? reference.number}
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(26rem,calc(100vw-2rem))] space-y-2.5 rounded-2xl p-3.5 shadow-xl border border-border/40"
      >
        <CitationCardHeader reference={reference} locatorLabel={locatorLabel} />
        <CitationEvidenceBody reference={reference} />
        <CitationActions reference={reference} safeUrl={safeUrl} />
      </HoverCardContent>
    </HoverCard>
  );
}

export interface CitationChipRowProps {
  references: CitationReference[];
  ariaLabel?: string;
}

export function CitationChipRow({ references, ariaLabel }: CitationChipRowProps) {
  const { t } = useTranslation("chat");

  if (references.length === 0) return null;

  return (
    <div
      aria-label={ariaLabel ?? t("referencePopover.referencesAria")}
      className="not-typeset mt-2 flex flex-wrap items-center gap-1"
      data-not-typeset
    >
      {references.map((reference) => (
        <CitationHoverCard key={`${reference.citationKey}-${reference.id}`} reference={reference} />
      ))}
    </div>
  );
}
