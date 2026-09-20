import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { CitedSourceDTO } from "../api/chat";
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
import {
  getReferenceExcerpt,
  getReferenceLocatorLabel,
  getSafeReferenceUrl,
} from "../types/message-reference.types";

interface ReferencePopoverProps {
  reference: CitedSourceDTO;
  children?: ReactNode;
}

export function ReferencePopover({ reference, children }: ReferencePopoverProps) {
  const { t } = useTranslation("chat");
  const safeUrl = getSafeReferenceUrl(reference.url);
  const kindLabel =
    reference.kind === "unknown" ? t("referencePopover.unknownKind") : capitalize(reference.kind);
  const locatorLabel = getReferenceLocatorLabel(reference);

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
        <ReferencePopoverHeader
          reference={reference}
          kindLabel={kindLabel}
          locatorLabel={locatorLabel}
        />
        <ReferenceOpenSourceButton reference={reference} safeUrl={safeUrl} />
      </PopoverContent>
    </Popover>
  );
}

interface ReferencePopoverHeaderProps {
  reference: CitedSourceDTO;
  kindLabel: string;
  locatorLabel: string | null;
}

function ReferencePopoverHeader({
  reference,
  kindLabel,
  locatorLabel,
}: ReferencePopoverHeaderProps) {
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
        {getReferenceExcerpt(reference)}
      </PopoverDescription>
    </PopoverHeader>
  );
}

interface ReferenceOpenSourceButtonProps {
  reference: CitedSourceDTO;
  safeUrl: string | null;
}

function ReferenceOpenSourceButton({
  reference,
  safeUrl,
}: ReferenceOpenSourceButtonProps) {
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

interface MessageReferencesProps {
  references: CitedSourceDTO[];
}

export function MessageReferences({ references }: MessageReferencesProps) {
  const { t } = useTranslation("chat");

  if (references.length === 0) return null;

  return (
    <div
      aria-label={t("referencePopover.referencesAria")}
      className="not-typeset mt-2 flex flex-wrap items-center gap-1"
      data-not-typeset
    >
      {references.map((reference) => (
        <ReferencePopover
          key={`${reference.citationKey}-${reference.id}-${reference.chunkId ?? "source"}`}
          reference={reference}
        />
      ))}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
