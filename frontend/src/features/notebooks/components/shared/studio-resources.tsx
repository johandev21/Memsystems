import { useQuery } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGenerationStore } from "@/features/study-material-generation";
import { KIND_LABELS, type StudyMaterialKind } from "@/features/study-material-viewer";
import { sourcesQueryOptions } from "@/features/sources";
import { cn } from "@/shared/utils/cn";

type ResourceConfig = {
  key: string;
  kind: StudyMaterialKind;
  icon: LucideIcon;
  label: string;
  colorClasses: string;
};

const RESOURCES: ResourceConfig[] = [
  {
    key: "studyGuide",
    kind: "study_guide",
    icon: BookOpen,
    label: "Study Guide",
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "quiz",
    kind: "quiz",
    icon: HelpCircle,
    label: "Quiz",
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "flashcards",
    kind: "simple_flashcard",
    icon: Brain,
    label: "Flashcards",
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "roadmap",
    kind: "roadmap",
    icon: MapIcon,
    label: "Roadmap",
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "mindMap",
    kind: "mind_map",
    icon: Network,
    label: "Mind Map",
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "practiceProblems",
    kind: "practice_problems",
    icon: ListChecks,
    label: "Practice Problems",
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "slides",
    kind: "slides",
    icon: Presentation,
    label: "Slides",
    colorClasses: "bg-studio-resource hover:bg-studio-resource-hover",
  },
  {
    key: "caseStudy",
    kind: "case_study",
    icon: Briefcase,
    label: "Case Study",
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
  const disabled = !isInScope(resource.kind);
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center relative",
                "text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground",
                disabled && "opacity-50 cursor-not-allowed",
              )}
              onClick={() => !disabled && onGenerate(resource.kind)}
              onKeyDown={(event) => {
                if (!disabled && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onGenerate(resource.kind);
                }
              }}
            >
              <resource.icon className="h-5 w-5" />
            </span>
          }
        >
          <span className="sr-only">{resource.label}</span>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={10}>
          {resource.label} {isGenerating ? "(Generating...)" : ""}
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
      <span className="min-w-0 truncate text-sm font-medium leading-tight">{resource.label}</span>
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
  if (generation.status === "error") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 shadow-xs transition-all animate-in fade-in slide-in-from-top-1">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-destructive/30 shadow-2xs text-destructive shrink-0">
            <CircleAlert className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground truncate">
              Failed to generate {KIND_LABELS[generation.kind] || generation.kind}
            </span>
            <span className="text-xs text-muted-foreground truncate wrap-break-words">
              {generation.error || "Generation failed"}
            </span>
            <button
              type="button"
              onClick={() => onCancel(generation.id)}
              className="mt-1 self-start text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg"
          onClick={() => onCancel(generation.id)}
          title="Dismiss error"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/60 dark:bg-muted/30 p-3 shadow-xs transition-all animate-in fade-in slide-in-from-top-1">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-border/50 shadow-2xs text-foreground shrink-0">
          <RefreshCw className="h-4.5 w-4.5 animate-spin text-primary" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-foreground truncate">
            Generating {KIND_LABELS[generation.kind] || generation.kind}...
          </span>
          <span className="text-xs text-muted-foreground truncate wrap-break-words">
            {getGenerationSubtitle(generation, totalSourceCount)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg"
        onClick={() => onCancel(generation.id)}
        title="Cancel generation"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function getGenerationSubtitle(generation: Generation, totalSourceCount: number) {
  const sourceCount = generation.sourceIds?.length ?? totalSourceCount;
  if (sourceCount > 0) return `based on ${sourceCount} source${sourceCount > 1 ? "s" : ""}`;
  return generation.brief ? "based on brief" : "processing sources";
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
