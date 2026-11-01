import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { CircleAlert, RefreshCw, X } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useGenerationStore } from "@/features/study-material-generation";
import type { StudyMaterialKind } from "@/features/study-material-viewer";
import { sourceSummaryQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";
import {
  KIND_LABEL_KEYS,
  RESOURCES,
  type ResourceConfig,
  isInScope,
} from "./studio-resources-config";

export interface StudioResourcesProps {
  notebookId: string;
  collapsed: boolean;
  onGenerate: (kind: StudyMaterialKind) => void;
}

export const StudioResources = memo(function StudioResources({
  notebookId,
  collapsed,
  onGenerate,
}: StudioResourcesProps) {
  const storeGenerations = useGenerationStore((s) => s.generations);
  const cancelBackgroundGeneration = useGenerationStore(
    (s) => s.cancelBackgroundGeneration,
  );
  const dismissGeneration = useGenerationStore((s) => s.dismissGeneration);
  const sourcesQuery = useQuery(sourceSummaryQueryOptions(notebookId));
  const totalSourceCount = sourcesQuery.data?.count ?? 0;

  const activeGenerations = Object.values(storeGenerations).filter(
    (g) => g.notebookId === notebookId,
  );

  if (collapsed) {
    return (
      <CollapsedResourceList
        activeGenerations={activeGenerations}
        totalSourceCount={totalSourceCount}
        onGenerate={onGenerate}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2 @container">
      <ResourceGrid
        totalSourceCount={totalSourceCount}
        onGenerate={onGenerate}
      />
      <ActiveGenerationList
        generations={activeGenerations}
        totalSourceCount={totalSourceCount}
        onCancel={(generationId) => {
          if (storeGenerations[generationId]?.status === "error") dismissGeneration(generationId);
          else void cancelBackgroundGeneration(notebookId, generationId);
        }}
      />
    </div>
  );
});

function CollapsedResourceList({
  activeGenerations,
  totalSourceCount,
  onGenerate,
}: {
  activeGenerations: ReturnType<
    typeof useGenerationStore.getState
  >["generations"][string][];
  totalSourceCount: number;
  onGenerate: (kind: StudyMaterialKind) => void;
}) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-0 py-2 px-0 items-center w-full">
        {RESOURCES.map((resource) => (
          <ResourceButton
            key={resource.key}
            resource={resource}
            collapsed
            totalSourceCount={totalSourceCount}
            isGenerating={activeGenerations.some(
              (generation) => generation.kind === resource.kind,
            )}
            onGenerate={onGenerate}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}

function ResourceGrid({
  totalSourceCount,
  onGenerate,
}: {
  totalSourceCount: number;
  onGenerate: (kind: StudyMaterialKind) => void;
}) {
  return (
    <div className="grid grid-cols-1 @[220px]:grid-cols-2 gap-1.5 sm:gap-2">
      {RESOURCES.map((resource) => (
        <ResourceButton
          key={resource.key}
          resource={resource}
          totalSourceCount={totalSourceCount}
          onGenerate={onGenerate}
        />
      ))}
    </div>
  );
}

function ResourceButton({
  resource,
  totalSourceCount = 1,
  onGenerate,
  collapsed = false,
  isGenerating = false,
}: {
  resource: ResourceConfig;
  totalSourceCount?: number;
  onGenerate: (kind: StudyMaterialKind) => void;
  collapsed?: boolean;
  isGenerating?: boolean;
}) {
  const { t } = useTranslation("notebooks");
  const disabled = !isInScope(resource.kind) || totalSourceCount === 0;
  const label = t(KIND_LABEL_KEYS[resource.kind]);
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center relative cursor-pointer touch-manipulation active:scale-97",
                "text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground",
                disabled && "opacity-50 cursor-not-allowed",
              )}
              onClick={() => !disabled && onGenerate(resource.kind)}
            >
              <resource.icon className="h-5 w-5" />
            </button>
          }
        >
          <span className="sr-only">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={10}>
          {isGenerating ? t("studio.tooltipGenerating", { label }) : label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onGenerate(resource.kind)}
      className={cn(
        "relative flex min-h-11 h-auto w-full items-center justify-between gap-1.5 sm:gap-2 overflow-hidden rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5 text-xs sm:text-sm font-medium text-muted-foreground outline-none transition-colors duration-200 select-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background cursor-pointer active:scale-97 transition-transform touch-manipulation",
        resource.colorClasses,
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className="min-w-0 truncate leading-tight">{label}</span>
      <resource.icon
        className="h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0"
        strokeWidth={1.75}
      />
    </button>
  );
}

type Generation = ReturnType<
  typeof useGenerationStore.getState
>["generations"][string];

export function ActiveGenerationList({
  generations,
  totalSourceCount,
  onCancel,
}: {
  generations: Generation[];
  totalSourceCount: number;
  onCancel: (generationId: string) => void;
}) {
  const { t } = useTranslation("notebooks");
  if (generations.length === 0) return null;
  const failures = generations.filter((generation) => generation.status === "error");
  const activeCount = generations.length - failures.length;

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between gap-2 px-1 py-2 text-xs font-medium">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span>{t("studio.inProgress", { count: activeCount })}</span>
          {failures.length > 0 && (
            <span className="text-destructive">{t("studio.failedCount", { count: failures.length })}</span>
          )}
        </div>
        {failures.length > 0 && (
          <button type="button" className="min-h-11 sm:min-h-0 text-muted-foreground hover:text-foreground hover:underline cursor-pointer touch-manipulation" onClick={() => failures.forEach((failure) => onCancel(failure.id))}>
            {t("studio.dismissErrors")}
          </button>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto overscroll-contain" role="region" aria-label={t("studio.generationActivity")} tabIndex={0}>
        {generations.map((generation) => (
          <ActiveGenerationCard key={generation.id} generation={generation} totalSourceCount={totalSourceCount} onCancel={onCancel} />
        ))}
      </div>
    </div>
  );
}

function ActiveGenerationCard({
  generation,
  totalSourceCount,
  onCancel,
}: {
  generation: Generation;
  totalSourceCount: number;
  onCancel: (generationId: string) => void;
}) {
  const { t } = useTranslation("notebooks");
  const failed = generation.status === "error";
  const kind = t(KIND_LABEL_KEYS[generation.kind]);
  const title = failed ? t("studio.failedToGenerate", { kind }) : t("studio.generating", { kind });
  const subtitle = failed
    ? generation.error || t("studio.generationFailed")
    : generation.kind === "audio_overview" && generation.stage
      ? t(`studio.audioOverview.${generation.stage}`)
      : getGenerationSubtitle(generation, totalSourceCount, t);
  const action = failed ? t("studio.dismissError") : t("studio.cancelGeneration");

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-border/50 last:border-b-0 px-2.5 py-2">
      {failed ? (
        <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
      ) : (
        <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-primary animate-spin motion-reduce:animate-none" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-foreground" title={title}>{title}</div>
        <div className="truncate text-xs text-muted-foreground" title={subtitle}>{subtitle}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 sm:size-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg touch-manipulation active:scale-97"
        onClick={() => onCancel(generation.id)}
        aria-label={`${action}: ${kind}`}
        title={action}
      >
        <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      </Button>
    </div>
  );
}

function getGenerationSubtitle(
  generation: Generation,
  totalSourceCount: number,
  t: TFunction<"notebooks">,
) {
  const sourceCount = generation.sourceIds?.length ?? totalSourceCount;
  if (sourceCount > 0)
    return t("resources.basedOnSources", { count: sourceCount });
  return generation.brief
    ? t("resources.basedOnBrief")
    : t("resources.processingSources");
}
