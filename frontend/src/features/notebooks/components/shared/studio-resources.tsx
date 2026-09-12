import { useQuery } from "@tanstack/react-query";
import type { ParseKeys, TFunction } from "i18next";
import {
  Brain,
  BookOpen,
  CircleAlert,
  HelpCircle,
  type LucideIcon,
  Map as MapIcon,
  Network,
  ListChecks,
  Presentation,
  Briefcase,
  RefreshCw,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGenerationStore } from "@/features/study-material-generation/hooks/use-generation-store";
import type { StudyMaterialKind } from "@/features/study-material-viewer";
import { sourcesQueryOptions } from "@/features/sources/api/sources";
import { cn } from "@/shared/utils/cn";

const KIND_LABEL_KEYS = {
  quiz: "studio.resources.quiz",
  simple_flashcard: "studio.resources.flashcards",
  roadmap: "studio.resources.roadmap",
  mind_map: "studio.resources.mindMap",
  slides: "studio.resources.slides",
  study_guide: "studio.resources.studyGuide",
  practice_problems: "studio.resources.practiceProblems",
  case_study: "studio.resources.caseStudy",
} as const satisfies Record<StudyMaterialKind, ParseKeys<"notebooks">>;

type ResourceConfig = {
  key: string;
  kind: StudyMaterialKind;
  icon: LucideIcon;
  colorClasses: string;
};

const RESOURCES: ResourceConfig[] = [
  {
    key: "studyGuide",
    kind: "study_guide",
    icon: BookOpen,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "quiz",
    kind: "quiz",
    icon: HelpCircle,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "flashcards",
    kind: "simple_flashcard",
    icon: Brain,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "roadmap",
    kind: "roadmap",
    icon: MapIcon,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "mindMap",
    kind: "mind_map",
    icon: Network,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "practiceProblems",
    kind: "practice_problems",
    icon: ListChecks,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "slides",
    kind: "slides",
    icon: Presentation,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "caseStudy",
    kind: "case_study",
    icon: Briefcase,
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
];

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
    <div className="flex flex-col gap-2 p-2">
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
      <div className="flex flex-col gap-3 py-2 px-0 items-center w-full">
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
    <div className="grid grid-cols-2 gap-2">
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
                "flex h-10 w-10 shrink-0 items-center justify-center relative cursor-pointer",
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
        "relative flex min-h-11 h-auto w-full items-center justify-between gap-2 overflow-hidden rounded-2xl px-3 py-2.5 text-muted-foreground outline-none transition-colors duration-200 select-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background cursor-pointer",
        resource.colorClasses,
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span className="min-w-0 truncate text-sm font-medium leading-tight">{label}</span>
      <resource.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
    </button>
  );
}

type Generation = ReturnType<typeof useGenerationStore.getState>["generations"][string];

function ActiveGenerationList({
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
            <span className="text-xs text-muted-foreground truncate wrap-break-words">
              {generation.error || t("studio.generationFailed")}
            </span>
            <button
              type="button"
              onClick={() => onCancel(generation.id)}
              className="mt-1 self-start text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              {t("studio.dismiss")}
            </button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg"
          onClick={() => onCancel(generation.id)}
          title={t("studio.dismissError")}
        >
          <X className="h-3.5 w-3.5" />
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
          <span className="text-xs text-muted-foreground truncate wrap-break-words">
            {getGenerationSubtitle(generation, totalSourceCount, t)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg"
        onClick={() => onCancel(generation.id)}
        title={t("studio.cancelGeneration")}
      >
        <X className="h-3.5 w-3.5" />
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

function isInScope(kind: StudyMaterialKind): boolean {
  return [
    "quiz",
    "simple_flashcard",
    "roadmap",
    "mind_map",
    "slides",
    "study_guide",
    "practice_problems",
    "case_study",
  ].includes(kind);
}
