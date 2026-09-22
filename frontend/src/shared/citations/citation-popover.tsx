import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
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
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * The shared citation surface: a numbered pill that opens a popover with the
 * source kind, title, locator, and supporting excerpt, plus an action to open
 * the source. Chat replies and generated Study Materials both use it.
 *
 * The popover labels live in the `chat` namespace, where the citation copy was
 * first written; keeping them there avoids duplicating the locator strings.
 */

interface CitationPopoverProps {
  reference: CitationReference;
  children?: ReactNode;
}

export function CitationPopover({ reference, children }: CitationPopoverProps) {
  const { t } = useTranslation("chat");
  const safeUrl = getSafeCitationUrl(reference.url);
  const kindLabel =
    reference.kind === "unknown" ? t("referencePopover.unknownKind") : capitalize(reference.kind);
  const locatorLabel = getCitationLocatorLabel(reference);

  return (
    <Popover>
      <PopoverTrigger
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
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))]"
      >
        <CitationPopoverHeader
          reference={reference}
          kindLabel={kindLabel}
          locatorLabel={locatorLabel}
        />
        <CitationOpenSourceButton reference={reference} safeUrl={safeUrl} />
      </PopoverContent>
    </Popover>
  );
}

function CitationPopoverHeader({
  reference,
  kindLabel,
  locatorLabel,
}: {
  reference: CitationReference;
  kindLabel: string;
  locatorLabel: string | null;
}) {
  const { t } = useTranslation("chat");

  return (
    <PopoverHeader>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{kindLabel}</Badge>
        {!reference.isAvailable && (
          <Badge variant="outline">{t("referencePopover.sourceUnavailable")}</Badge>
        )}
      </div>
      <PopoverTitle>{reference.title}</PopoverTitle>
      {locatorLabel && (
        <div className="text-xs font-medium text-muted-foreground">{locatorLabel}</div>
      )}
      <PopoverDescription className="max-h-48 overflow-y-auto leading-relaxed">
        {getCitationExcerpt(reference)}
      </PopoverDescription>
    </PopoverHeader>
  );
}

function CitationOpenSourceButton({
  reference,
  safeUrl,
}: {
  reference: CitationReference;
  safeUrl: string | null;
}) {
  const { t } = useTranslation("chat");

  if (!reference.isAvailable) return null;

  const hasCustomLocator = Boolean(
    reference.locator?.imageRegion ||
    typeof reference.locator?.startOffsetMs === "number" ||
    typeof reference.locator?.slideNumber === "number" ||
    reference.locator?.symbol ||
    reference.locator?.cellRange ||
    reference.locator?.sheetName ||
    !safeUrl,
  );

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

  if (hasCustomLocator && reference.id) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="cursor-pointer"
        onClick={handleOpenSourceViewer}
      >
        {t("referencePopover.openSource")}
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    );
  }

  if (safeUrl) {
    return (
      <Button
        render={
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("referencePopover.openSource")}
          >
            {t("referencePopover.openSource")}
          </a>
        }
        nativeButton={false}
        size="sm"
        variant="ghost"
      >
        {t("referencePopover.openSource")}
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    );
  }

  if (reference.id) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="cursor-pointer"
        onClick={handleOpenSourceViewer}
      >
        {t("referencePopover.openSource")}
        <ExternalLinkIcon data-icon="inline-end" />
      </Button>
    );
  }

  return null;
}

interface CitationChipRowProps {
  references: CitationReference[];
  /** Accessible label for the row; defaults to the Chat copy. */
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
        <CitationPopover key={`${reference.citationKey}-${reference.id}`} reference={reference} />
      ))}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
