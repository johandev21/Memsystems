import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { CircleAlert, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGenerationStore } from "@/features/study-material-generation/hooks/use-generation-store";
import type { StudyMaterialKind } from "@/features/study-material-viewer";
import { sourcesQueryOptions } from "@/features/sources/api/sources";
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

export function StudioResources({ notebookId, collapsed, onGenerate }: StudioResourcesProps) {
  const storeGenerations = useGenerationStore((s) => s.generations);
  const cancelBackgroundGeneration = useGenerationStore((s) => s.cancelBackgroundGeneration);
  const sourcesQuery = useQuery(sourcesQueryOptions(notebookId));
  const totalSourceCount = sourcesQuery.data?.length ?? 0;

  const activeGenerations = Object.values(storeGenerations).filter(
    (g) => g.notebookId === notebookId,
  );

  if (collapsed) {
    return <CollapsedResourceList activeGenerations={activeGenerations} onGenerate={onGenerate} />;
  }

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-2">
      <ResourceGrid onGenerate={onGenerate} />
      <ActiveGenerationList
        generations={activeGenerations}
        totalSourceCount={totalSourceCount}
        onCancel={(generationId) => cancelBackgroundGeneration(notebookId, generationId)}
      />
    </div>
  );
}

function CollapsedResourceList({
  activeGenerations,
  onGenerate,
}: {
  activeGenerations: ReturnType<typeof useGenerationStore.getState>["generations"][string][];
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
            isGenerating={activeGenerations.some((generation) => generation.kind === resource.kind)}
            onGenerate={onGenerate}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}

function ResourceGrid({ onGenerate }: { onGenerate: (kind: StudyMaterialKind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
      {RESOURCES.map((resource) => (
        <ResourceButton key={resource.key} resource={resource} onGenerate={onGenerate} />
      ))}
    </div>
  );
}

function ResourceButton({
  resource,
  onGenerate,
  collapsed = false,
  isGenerating = false,
}: {
  resource: ResourceConfig;
  onGenerate: (kind: StudyMaterialKind) => void;
  collapsed?: boolean;
  isGenerating?: boolean;
}) {
  const { t } = useTranslation("notebooks");
  const disabled = !isInScope(resource.kind);
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
      <resource.icon className="h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0" strokeWidth={1.75} />
    </button>
  );
}

type Generation = ReturnType<typeof useGenerationStore.getState>["generations"][string];

export function ActiveGenerationList({
  generations,
  totalSourceCount,
  onCancel,
}: {
  generations: Generation[];
  totalSourceCount: number;
  onCancel: (generationId: string) => void;
}) {
  if (generations.length === 0) return null;
  return (
    <div className="space-y-2 mt-1">
      {generations.map((generation) => (
        <ActiveGenerationCard
          key={generation.id}
          generation={generation}
          totalSourceCount={totalSourceCount}
          onCancel={onCancel}
        />
      ))}
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

  if (generation.status === "error") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 shadow-xs transition-colors animate-in fade-in slide-in-from-top-1">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-destructive/30 shadow-2xs text-destructive shrink-0">
            <CircleAlert className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground truncate">
              {t("studio.failedToGenerate", {
                kind: t(KIND_LABEL_KEYS[generation.kind]),
              })}
            </span>
            <span className="text-xs text-muted-foreground truncate wrap-break-word">
              {generation.error || t("studio.generationFailed")}
            </span>
            <button
              type="button"
              onClick={() => onCancel(generation.id)}
              className="mt-1 min-h-11 py-2 sm:min-h-0 sm:py-0 self-start text-xs font-medium text-primary hover:underline cursor-pointer touch-manipulation active:scale-97 inline-flex items-center"
            >
              {t("studio.dismiss")}
            </button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 sm:size-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg touch-manipulation active:scale-97"
          onClick={() => onCancel(generation.id)}
          title={t("studio.dismissError")}
        >
          <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/60 dark:bg-muted/30 p-3 shadow-xs transition-colors animate-in fade-in slide-in-from-top-1">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-border/50 shadow-2xs text-foreground shrink-0">
          <RefreshCw className="h-4.5 w-4.5 animate-spin text-primary" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-foreground truncate">
            {t("studio.generating", {
              kind: t(KIND_LABEL_KEYS[generation.kind]),
            })}
          </span>
          <span className="text-xs text-muted-foreground truncate wrap-break-word">
            {getGenerationSubtitle(generation, totalSourceCount, t)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 sm:size-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg touch-manipulation active:scale-97"
        onClick={() => onCancel(generation.id)}
        title={t("studio.cancelGeneration")}
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
  if (sourceCount > 0) return t("resources.basedOnSources", { count: sourceCount });
  return generation.brief ? t("resources.basedOnBrief") : t("resources.processingSources");
}
