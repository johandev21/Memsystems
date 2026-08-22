import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  HelpCircle,
  type LucideIcon,
  Map as MapIcon,
  Network,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { useGenerationStore } from "@/features/study-materials";
import { KIND_LABELS, type StudyMaterialKind } from "@/features/study-materials";
import { sourcesQueryOptions } from "@/shared/api/sources";
import { cn } from "@/shared/lib/utils";

type ResourceConfig = {
  key: string;
  kind: StudyMaterialKind;
  icon: LucideIcon;
  label: string;
  colorClasses: string;
};

const RESOURCES: ResourceConfig[] = [
  {
    key: "quiz",
    kind: "quiz",
    icon: HelpCircle,
    label: "Quiz",
    colorClasses:
      "bg-studio-resource hover:bg-studio-resource-hover text-studio-resource-foreground",
  },
  {
    key: "flashcards",
    kind: "simple_flashcard",
    icon: Brain,
    label: "Flashcards",
    colorClasses:
      "bg-studio-resource hover:bg-studio-resource-hover text-studio-resource-foreground",
  },
  {
    key: "roadmap",
    kind: "roadmap",
    icon: MapIcon,
    label: "Roadmap",
    colorClasses:
      "bg-studio-resource hover:bg-studio-resource-hover text-studio-resource-foreground",
  },
  {
    key: "mindMap",
    kind: "mind_map",
    icon: Network,
    label: "Mind Map",
    colorClasses:
      "bg-studio-resource hover:bg-studio-resource-hover text-studio-resource-foreground",
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
    return (
      <TooltipProvider>
        <div className="flex flex-col gap-3 py-2 px-0 items-center w-full">
          {RESOURCES.map((resource) => {
            const isGenerating = activeGenerations.some((g) => g.kind === resource.kind);
            const disabled = !isInScope(resource.kind);
            return (
              <Tooltip key={resource.key}>
                <TooltipTrigger
                  render={
                    <span
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center relative",
                        "text-studio-resource-foreground",
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
          })}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Creation Buttons Grid */}
      <div className="grid grid-cols-2 gap-2">
        {RESOURCES.map((resource) => {
          const disabled = !isInScope(resource.kind);

          return (
            <button
              key={resource.key}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onGenerate(resource.kind)}
              className={cn(
                "group relative flex items-center min-h-11 h-auto py-2.5 w-full justify-between px-3 gap-2 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background rounded-2xl cursor-pointer select-none overflow-hidden",
                resource.colorClasses,
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <span className="text-[13px] font-medium text-foreground min-w-0 truncate leading-tight">
                {resource.label}
              </span>

              <resource.icon
                className={cn(
                  "h-4.5 w-4.5 shrink-0 transition-transform group-hover:scale-105",
                  "text-studio-resource-icon opacity-80 group-hover:opacity-100",
                )}
                strokeWidth={1.75}
              />
            </button>
          );
        })}
      </div>

      {/* Active Generation Progress Cards matching Image 1 & 2 */}
      {activeGenerations.length > 0 && (
        <div className="space-y-2 mt-1">
          {activeGenerations.map((job) => {
            const sourceCount = job.sourceIds?.length ?? totalSourceCount;
            const subtitleText =
              sourceCount > 0
                ? `based on ${sourceCount} source${sourceCount > 1 ? "s" : ""}`
                : job.brief
                  ? `based on brief`
                  : "processing sources";

            return (
              <div
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/60 dark:bg-muted/30 p-3 shadow-xs transition-all animate-in fade-in slide-in-from-top-1"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-border/50 shadow-2xs text-foreground shrink-0">
                    <RefreshCw className="h-4.5 w-4.5 animate-spin text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-foreground truncate">
                      Generating {KIND_LABELS[job.kind] || job.kind}...
                    </span>
                    <span className="text-xs text-muted-foreground truncate wrap-break-words">
                      {subtitleText}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer rounded-lg"
                  onClick={() => cancelBackgroundGeneration(notebookId, job.id)}
                  title="Cancel generation"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isInScope(kind: StudyMaterialKind): boolean {
  return ["quiz", "simple_flashcard", "roadmap", "mind_map"].includes(kind);
}
