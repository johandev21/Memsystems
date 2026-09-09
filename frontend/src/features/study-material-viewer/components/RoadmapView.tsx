import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/cn";
import { formatDisplayTitle } from "../utils/format-title";
import { useRoadmapProgress, type RoadmapPhase, type RoadmapTopic } from "../hooks/use-roadmap-progress";
import "./roadmap-theme.css";

// =============================================================================
// Types & Interfaces
// =============================================================================

import type { RoadmapContentType } from "../shapes/roadmap";

export type RoadmapContent = RoadmapContentType;

export interface RoadmapViewProps {
  materialId: string;
  content: RoadmapContent;
}

interface RoadmapHeaderProps {
  title?: string;
  description?: string;
}

interface PhaseMilestoneCardProps {
  phase: RoadmapPhase;
  phaseIndex: number;
  onStudyPhase: (phase: RoadmapPhase, phaseIndex: number) => void;
}

interface TopicCardProps {
  topic: RoadmapTopic;
  isLeft: boolean;
}

interface RoadmapSpineProps {
  phases: RoadmapPhase[];
  onStudyPhase: (phase: RoadmapPhase, phaseIndex: number) => void;
}

interface RoadmapPhaseSectionProps {
  phase: RoadmapPhase;
  phaseIndex: number;
  onStudyPhase: (phase: RoadmapPhase, phaseIndex: number) => void;
}

// =============================================================================
// Constants
// =============================================================================

const SEND_CHAT_PROMPT_EVENT = "send-chat-prompt";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formats a phase index label (e.g. "Phase 1").
 */
function formatMilestoneLabel(phaseIndex: number): string {
  return `Phase ${phaseIndex + 1}`;
}

/**
 * Formats phase topics into a numbered summary list for AI chat prompts.
 */
function formatTopicSummary(topics: RoadmapTopic[]): string {
  return topics
    .map(
      (topic, index) =>
        `${index + 1}. **${formatDisplayTitle(topic.title)}**${topic.description ? `: ${topic.description}` : ""}`,
    )
    .join("\n");
}

/**
 * Builds the AI chat prompt for studying an entire phase.
 */
function buildPhaseStudyPrompt(
  phase: RoadmapPhase,
  phaseIndex: number,
  roadmapTitle?: string,
): string {
  const formattedPhaseTitle = formatDisplayTitle(phase.title);
  const topicSummary = formatTopicSummary(phase.topics);
  const roadmapContext = roadmapTitle ? ` ("${formatDisplayTitle(roadmapTitle)}")` : "";

  return `I'm studying Phase ${phaseIndex + 1}: "${formattedPhaseTitle}" from my learning roadmap${roadmapContext}.\n\nPhase Description: ${phase.description || "N/A"}\n\nTopics covered in this phase:\n${topicSummary}\n\nPlease act as my interactive AI tutor for this phase. Start by giving me a clear, high-level summary of what I'll master in this phase, and then ask me an initial concept question to check my understanding and kick off our study session!`;
}

/**
 * Builds the clipboard text for a single topic node.
 */
function buildTopicCopyText(topic: RoadmapTopic): string {
  const lines: string[] = [formatDisplayTitle(topic.title)];
  if (topic.description) {
    lines.push("", topic.description);
  }
  if (topic.keyTakeaways?.length) {
    lines.push("", "Key Objectives:");
    topic.keyTakeaways.forEach((keyPoint) => lines.push(`- ${keyPoint}`));
  }
  return lines.join("\n");
}

/**
 * Dispatches a custom event to send a prompt to the chat panel.
 */
function dispatchChatPrompt(promptText: string): void {
  window.dispatchEvent(
    new CustomEvent(SEND_CHAT_PROMPT_EVENT, {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Determines if a topic index should be placed on the left side of the grid.
 */
function isLeftPosition(topicIndex: number): boolean {
  return topicIndex % 2 === 0;
}

// =============================================================================
// Custom Hooks
// =============================================================================

// (No custom hooks required; useRoadmapProgress is imported)

// =============================================================================
// Derived State Helpers
// =============================================================================

// (No derived state helpers required)

// =============================================================================
// Local Components
// =============================================================================

function RoadmapHeader({ title, description }: RoadmapHeaderProps) {
  if (!title) return null;

  return (
    <div className="flex flex-col items-center gap-2.5 text-center max-w-2xl px-2">
      <h1 className="text-lg @sm:text-2xl @3xl:text-3xl font-extrabold tracking-tight text-text-primary wrap-break-words leading-tight">
        {formatDisplayTitle(title)}
      </h1>

      {description && (
        <p className="roadmap-description text-xs @sm:text-sm @3xl:text-base leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

function PhaseMilestoneCard({ phase, phaseIndex, onStudyPhase }: PhaseMilestoneCardProps) {
  return (
    <div className="rounded-2xl border bg-surface-2 border-surface-border-subtle p-4 @sm:p-5 @3xl:p-6 max-w-full sm:max-w-lg w-full text-center flex flex-col items-center gap-2.5">
      <Badge
        variant="default"
        className="bg-primary text-primary-foreground border-primary text-xs font-semibold px-2.5 py-0.5"
      >
        {formatMilestoneLabel(phaseIndex)}
      </Badge>

      <h3 className="text-base @sm:text-lg @3xl:text-xl font-extrabold text-text-primary tracking-tight leading-snug wrap-break-words">
        {formatDisplayTitle(phase.title)}
      </h3>

      {phase.description && (
        <p className="roadmap-description text-xs @sm:text-sm leading-relaxed wrap-break-words">
          {phase.description}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onStudyPhase(phase, phaseIndex)}
        className="mt-1 h-8 @sm:h-9 px-3 @sm:px-4 rounded-xl border border-surface-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3 text-xs @sm:text-sm font-medium cursor-pointer transition-colors"
      >
        Study in chat
      </Button>
    </div>
  );
}

function TopicCard({ topic, isLeft }: TopicCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleCopy = async () => {
    const text = buildTopicCopyText(topic);
    if (!navigator?.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Copied");
      timeoutRef.current = window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full",
        isLeft ? "@3xl:justify-end @3xl:pr-6" : "@3xl:justify-start @3xl:pl-6",
      )}
    >
      {/* Horizontal Connector Line (wide container only) */}
      <div
        className={cn(
          "hidden @3xl:block absolute top-1/2 border-t-2 border-dashed border-primary/40 z-0 w-6",
          isLeft ? "-right-0" : "-left-0",
        )}
      />

      {/* Topic Box Card */}
      <div className="group relative rounded-xl border border-surface-border-subtle bg-surface-2 p-3.5 @sm:p-4 @3xl:p-5 flex flex-col gap-1.5 @sm:gap-2 w-full max-w-full @3xl:max-w-sm z-10">
        <h4 className="text-sm @sm:text-base font-bold text-text-tertiary leading-snug wrap-break-words">
          {formatDisplayTitle(topic.title)}
        </h4>

        {topic.description && (
          <p className="roadmap-description text-xs @sm:text-sm line-clamp-3 leading-relaxed wrap-break-words">
            {topic.description}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label={`Copy ${formatDisplayTitle(topic.title)}`}
          className="absolute top-2 right-2 text-text-faint hover:text-text-secondary opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100"
        >
          {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function RoadmapSpine({ phases, onStudyPhase }: RoadmapSpineProps) {
  return (
    <div className="relative w-full flex flex-col items-center gap-8 @sm:gap-12 @3xl:gap-14 pt-2">
      {/* Spine Line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-surface-4 -translate-x-1/2 z-0" />

      {phases.map((phase, phaseIndex) => (
        <RoadmapPhaseSection
          key={phase.id}
          phase={phase}
          phaseIndex={phaseIndex}
          onStudyPhase={onStudyPhase}
        />
      ))}
    </div>
  );
}

function RoadmapPhaseSection({ phase, phaseIndex, onStudyPhase }: RoadmapPhaseSectionProps) {
  return (
    <div className="relative z-10 w-full flex flex-col items-center gap-4 @sm:gap-6 @3xl:gap-8">
      <PhaseMilestoneCard phase={phase} phaseIndex={phaseIndex} onStudyPhase={onStudyPhase} />
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4 @sm:gap-6 @3xl:gap-8 w-full px-1 @sm:px-4">
        {phase.topics.map((topic, topicIndex) => (
          <TopicCard key={topic.id} topic={topic} isLeft={isLeftPosition(topicIndex)} />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component (Orchestrator)
// =============================================================================

export function RoadmapView({ materialId, content }: RoadmapViewProps) {
  // 1. Hooks
  useRoadmapProgress(materialId, content.phases);

  // 2. State

  // 3. Derived Values

  // 4. Memoized Values

  // 5. Event Handlers
  const handleStudyPhaseInChat = (phase: RoadmapPhase, phaseIndex: number) => {
    const promptText = buildPhaseStudyPrompt(phase, phaseIndex, content.title);
    dispatchChatPrompt(promptText);
  };

  // 6. Render
  return (
    <div className="roadmap-view @container flex flex-col items-center gap-6 @sm:gap-8 @3xl:gap-10 w-full max-w-4xl mx-auto animate-in fade-in duration-300 pb-20 select-none px-3 @sm:px-4">
      <RoadmapHeader title={content.title} description={content.description} />

      <RoadmapSpine phases={content.phases} onStudyPhase={handleStudyPhaseInChat} />
    </div>
  );
}

// =============================================================================
// Export
// =============================================================================

export default RoadmapView;
