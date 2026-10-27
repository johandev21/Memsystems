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
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  cleanBreadcrumbSegment,
  cleanProseText,
  getCitationExcerpt,
  getCitationLocatorLabel,
  getSafeCitationUrl,
  isMarkdownCitation,
  prepareCitationText,
  type CitationReference,
} from "./citation";
import { MarkdownRenderer, type MarkdownComponents } from "@/shared/components/ui/markdown";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/shared/components/ui/hover-card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";
import {
  notifyCitationClosed,
  notifyCitationOpened,
  useIsAnyOtherCitationActive,
} from "./citation-hover-group";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { cn } from "@/shared/utils/cn";
import { SourceFavicon } from "@/features/sources";

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
  const isTouchDevice = useMediaQuery("(pointer: coarse)");
  const isTouch = forceDrawer ?? isTouchDevice;
  const safeUrl = getSafeCitationUrl(reference.url);
  const locatorLabel = getCitationLocatorLabel(reference);

  const referenceKey = reference.id || reference.citationKey || String(reference.number);
  const isGroupActive = useIsAnyOtherCitationActive(referenceKey);
  const delay = isGroupActive ? 0 : 250;

  if (isTouch) {
    return (
      <Drawer>
        <DrawerTrigger render={<CitationTriggerButton reference={reference} />}>
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

          <CitationCardBody
            reference={reference}
            locatorLabel={locatorLabel}
            safeUrl={safeUrl}
          />
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
        render={<CitationTriggerButton reference={reference} />}
      >
        {children ?? reference.number}
      </HoverCardTrigger>

      <HoverCardContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(26rem,calc(100vw-2rem))] space-y-2.5 rounded-2xl p-3.5 shadow-xl border border-border/40"
      >
        <CitationCardBody
          reference={reference}
          locatorLabel={locatorLabel}
          safeUrl={safeUrl}
        />
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

interface CitationTriggerButtonProps extends React.ComponentProps<typeof Button> {
  reference: CitationReference;
}

function CitationTriggerButton({
  reference,
  children,
  className,
  ...props
}: CitationTriggerButtonProps) {
  const { t } = useTranslation("chat");
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="secondary"
      aria-label={t("referencePopover.triggerAria", {
        number: reference.number,
        title: reference.title,
      })}
      className={cn(
        "relative -top-px mx-0.5 inline-flex h-5 w-auto min-w-5 rounded-full px-1 align-baseline text-xs leading-none text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children ?? reference.number}
    </Button>
  );
}

function CitationCardBody({
  reference,
  locatorLabel,
  safeUrl,
}: {
  reference: CitationReference;
  locatorLabel: string | null;
  safeUrl: string | null;
}) {
  return (
    <>
      <CitationCardHeader reference={reference} locatorLabel={locatorLabel} />
      <CitationEvidenceBody reference={reference} />
      <CitationActions reference={reference} safeUrl={safeUrl} />
    </>
  );
}

const citationKindIcons: Record<string, LucideIcon> = {
  video: Video,
  audio: Headphones,
  image: ImageIcon,
  slides: Presentation,
  presentation: Presentation,
  ebook: BookOpen,
  epub: BookOpen,
  url: Globe,
  web: Globe,
  pdf: FileText,
  file: FileText,
  document: FileText,
};

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

  if (url && (normalized === "url" || normalized === "web" || isYoutube)) {
    return (
      <SourceFavicon
        url={url}
        className={cn("object-contain rounded-xs", className)}
        fallback={
          isYoutube ? (
            <Video className={className} aria-hidden="true" />
          ) : (
            <Globe className={className} aria-hidden="true" />
          )
        }
      />
    );
  }

  const Icon = citationKindIcons[normalized] ?? File;
  return <Icon className={className} aria-hidden="true" />;
}

const compactMarkdownComponents: MarkdownComponents = {
  p: ({ children }) => (
    <p className="my-1.5 leading-relaxed text-foreground/90 select-text font-normal">{children}</p>
  ),
  h1: ({ children }) => <div className="font-semibold my-1 text-foreground">{children}</div>,
  h2: ({ children }) => <div className="font-semibold my-1 text-foreground">{children}</div>,
  h3: ({ children }) => <div className="font-semibold my-1 text-foreground">{children}</div>,
  h4: ({ children }) => <div className="font-semibold my-1 text-foreground">{children}</div>,
  h5: ({ children }) => <div className="font-medium my-1 text-foreground">{children}</div>,
  h6: ({ children }) => <div className="font-medium my-1 text-foreground">{children}</div>,
  ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-2 my-1 italic text-foreground/80">
      {children}
    </blockquote>
  ),
  a: ({ children }) => <span className="underline underline-offset-2">{children}</span>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
};

export function CitationEvidenceBody({ reference }: { reference: CitationReference }) {
  const rawText =
    reference.context?.trim() ||
    reference.quote?.trim() ||
    getCitationExcerpt(reference);

  const text = prepareCitationText(rawText);
  const isMarkdown = isMarkdownCitation(reference, text);

  return (
    <div
      data-slot="citation-evidence"
      className="max-h-56 overflow-y-auto text-xs leading-relaxed text-foreground/90 select-text pr-1 pb-1"
    >
      {isMarkdown ? (
        <MarkdownRenderer components={compactMarkdownComponents}>
          {text}
        </MarkdownRenderer>
      ) : (
        <p className="my-1.5 leading-relaxed text-foreground/90 select-text font-normal">
          {cleanProseText(text)}
        </p>
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
          className="flex items-center gap-1 text-xs text-muted-foreground truncate"
        >
          {reference.sectionPath.map(cleanBreadcrumbSegment).join(" > ")}
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2 border-t border-border/40">
      <CitationQuoteAction reference={reference} />
      <CitationSourceActions reference={reference} safeUrl={safeUrl} />
    </div>
  );
}

function CitationQuoteAction({ reference }: { reference: CitationReference }) {
  const { t } = useTranslation("chat");
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  const rawQuote = reference.quote?.trim() || reference.description?.trim();
  const quoteToCopy = cleanProseText(rawQuote);

  const handleCopy = async () => {
    if (!quoteToCopy) return;
    try {
      await navigator.clipboard.writeText(quoteToCopy);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
    }
  };

  if (!quoteToCopy) return null;

  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      className="cursor-pointer gap-1.5 text-xs h-7 min-w-0"
      onClick={handleCopy}
      aria-label={
        copied ? t("referencePopover.quoteCopiedAria") : t("referencePopover.copyQuoteAria")
      }
    >
      {copied ? (
        <Check className="size-3 text-primary" data-icon="inline-start" />
      ) : (
        <Copy className="size-3" data-icon="inline-start" />
      )}
      <span className="min-w-12 text-left">
        {copied ? t("referencePopover.quoteCopied") : t("referencePopover.copyQuote")}
      </span>
    </Button>
  );
}

function CitationSourceActions({
  reference,
  safeUrl,
}: {
  reference: CitationReference;
  safeUrl: string | null;
}) {
  const { t } = useTranslation("chat");
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

  const canOpenInApp = hasInAppViewer && Boolean(reference.id);
  const canOpenExternal = Boolean(safeUrl) && !canOpenInApp;
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

  return (
    <div className="flex flex-wrap items-center justify-end gap-1 ml-auto min-w-0">
      {canOpenInApp && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="cursor-pointer gap-1.5 text-xs h-7"
          onClick={handleOpenSourceViewer}
        >
          {t("referencePopover.openSource")}
        </Button>
      )}

      {canOpenExternal && (
        <Button
          render={
            <a href={safeUrl ?? undefined} target="_blank" rel="noopener noreferrer">
              {t("referencePopover.openSource")}
              <ExternalLinkIcon className="size-3" data-icon="inline-end" />
            </a>
          }
          nativeButton={false}
          size="xs"
          variant="ghost"
          className="cursor-pointer gap-1.5 text-xs h-7"
        />
      )}
    </div>
  );
}
