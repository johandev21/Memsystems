import { useState } from "react";
import { Sparkles, Target } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn, formatDisplayTitle } from "@/shared/lib/utils";
import { useRoadmapProgress, type RoadmapPhase, type RoadmapTopic } from "./useRoadmapProgress";
import "./roadmap-theme.css";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface RoadmapContent {
  title?: string;
  description?: string;
  targetRole?: string;
  phases: RoadmapPhase[];
}

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
  onSelectTopic: (topic: RoadmapTopic) => void;
}

interface RoadmapSpineProps {
  phases: RoadmapPhase[];
  onStudyPhase: (phase: RoadmapPhase, phaseIndex: number) => void;
  onSelectTopic: (topic: RoadmapTopic) => void;
}

interface TopicDetailModalProps {
  topic: RoadmapTopic | null;
  onClose: () => void;
  onExplainInChat: (topic: RoadmapTopic) => void;
}

// =============================================================================
// Constants
// =============================================================================

const SEND_CHAT_PROMPT_EVENT = "send-chat-prompt";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formats a 0-padded milestone index label (e.g. "MILESTONE 01").
 */
function formatMilestoneLabel(phaseIndex: number): string {
  return `MILESTONE 0${phaseIndex + 1}`;
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
 * Builds the AI chat prompt for explaining a specific topic.
 */
function buildTopicExplainPrompt(topic: RoadmapTopic, roadmapTitle?: string): string {
  const formattedTopicTitle = formatDisplayTitle(topic.title);
  const roadmapContext = roadmapTitle
    ? ` in my roadmap ("${formatDisplayTitle(roadmapTitle)}")`
    : "";
  const takeawaysText = topic.keyTakeaways?.length
    ? `\n\nKey Objectives:\n${topic.keyTakeaways.map((keyPoint) => `- ${keyPoint}`).join("\n")}`
    : "";

  return `I'm studying the topic "${formattedTopicTitle}"${roadmapContext}.\n\nDescription: ${topic.description || "N/A"}${takeawaysText}\n\nPlease explain this concept in depth with practical examples, best practices, and key insights I should keep in mind.`;
}

/**
 * Dispatches a custom event to send a prompt to the chat panel.
 */
function dispatchChatPrompt(promptText: string): void {
  window.dispatchEvent(
    new CustomEvent(SEND_CHAT_PROMPT_EVENT, {
      detail: { prompt: promptText, autoSend: true },
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
      <h1 className="text-lg @sm:text-2xl @3xl:text-3xl font-extrabold tracking-tight text-foreground wrap-break-words leading-tight">
        {formatDisplayTitle(title)}
      </h1>

      {description && (
        <p className="roadmap-muted text-xs @sm:text-sm @3xl:text-base leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

function PhaseMilestoneCard({ phase, phaseIndex, onStudyPhase }: PhaseMilestoneCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 @sm:p-5 @3xl:p-6 max-w-full sm:max-w-lg w-full text-center flex flex-col items-center gap-2.5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs">
      <Badge
        variant="default"
        className="bg-primary text-primary-foreground border-primary text-xs font-bold uppercase px-2.5 py-0.5"
      >
        {formatMilestoneLabel(phaseIndex)}
      </Badge>

      <h3 className="text-base @sm:text-lg @3xl:text-xl font-extrabold text-foreground tracking-tight leading-snug wrap-break-words">
        {formatDisplayTitle(phase.title)}
      </h3>

      {phase.description && (
        <p className="roadmap-muted text-xs @sm:text-sm leading-relaxed wrap-break-words">
          {phase.description}
        </p>
      )}

      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={() => onStudyPhase(phase, phaseIndex)}
        className="mt-1 h-8 @sm:h-9 px-3 @sm:px-4 rounded-xl border-primary bg-primary text-primary-foreground text-xs @sm:text-sm font-semibold gap-2 cursor-pointer transition-colors hover:bg-primary/90"
      >
        <Sparkles className="size-3.5 @sm:size-4" />
        <span>Study Phase in Chat</span>
      </Button>
    </div>
  );
}

function TopicCard({ topic, isLeft, onSelectTopic }: TopicCardProps) {
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
      <div
        onClick={() => onSelectTopic(topic)}
        tabIndex={0}
        role="button"
        aria-label={`Topic: ${formatDisplayTitle(topic.title)}`}
        className="group bg-card border border-border/80 hover:border-primary/60 rounded-xl p-3.5 @sm:p-4 @3xl:p-5 flex flex-col gap-1.5 @sm:gap-2 cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-[0.99] w-full max-w-full @3xl:max-w-sm z-10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h4 className="text-sm @sm:text-base font-bold text-foreground group-hover:text-primary transition-colors leading-snug wrap-break-words">
          {formatDisplayTitle(topic.title)}
        </h4>

        {topic.description && (
          <p className="roadmap-muted text-xs @sm:text-sm line-clamp-3 leading-relaxed wrap-break-words">
            {topic.description}
          </p>
        )}
      </div>
    </div>
  );
}

function RoadmapSpine({ phases, onStudyPhase, onSelectTopic }: RoadmapSpineProps) {
  return (
    <div className="relative w-full flex flex-col items-center gap-8 @sm:gap-12 @3xl:gap-14 pt-2">
      {/* Spine Line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-primary/30 -translate-x-1/2 z-0" />

      {phases.map((phase, phaseIndex) => (
        <div
          key={phase.id}
          className="relative z-10 w-full flex flex-col items-center gap-4 @sm:gap-6 @3xl:gap-8"
        >
          <PhaseMilestoneCard phase={phase} phaseIndex={phaseIndex} onStudyPhase={onStudyPhase} />

          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4 @sm:gap-6 @3xl:gap-8 w-full px-1 @sm:px-4">
            {phase.topics.map((topic, topicIndex) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                isLeft={isLeftPosition(topicIndex)}
                onSelectTopic={onSelectTopic}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TopicDetailModal({ topic, onClose, onExplainInChat }: TopicDetailModalProps) {
  const isModalOpen = Boolean(topic);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full p-4 @sm:p-6 gap-4 @sm:gap-5 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-xl">
        {topic && (
          <>
            <DialogHeader className="gap-2 shrink-0">
              <DialogTitle className="text-base sm:text-xl font-bold text-foreground tracking-tight wrap-break-words">
                {formatDisplayTitle(topic.title)}
              </DialogTitle>

              {topic.description && (
                <DialogDescription className="roadmap-muted text-xs sm:text-sm leading-relaxed wrap-break-words">
                  {topic.description}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Key Objectives */}
            {topic.keyTakeaways && topic.keyTakeaways.length > 0 && (
              <div className="bg-muted p-3.5 sm:p-4 rounded-xl border border-border flex flex-col gap-2.5">
                <span className="font-bold uppercase text-xs text-primary flex items-center gap-1.5">
                  <Target className="size-4 shrink-0" /> Key Objectives
                </span>
                <ul className="roadmap-muted flex flex-col gap-2 text-xs sm:text-sm">
                  {topic.keyTakeaways.map((keyPoint, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span className="text-foreground leading-relaxed wrap-break-words">
                        {keyPoint}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dialog Actions */}
            <div className="flex items-center justify-end pt-2 shrink-0">
              <Button
                type="button"
                onClick={() => onExplainInChat(topic)}
                className="w-full h-10 sm:h-11 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold gap-2 cursor-pointer shadow-2xs"
              >
                <Sparkles className="size-4" />
                <span>Explain in Chat</span>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main Component (Orchestrator)
// =============================================================================

export function RoadmapView({ materialId, content }: RoadmapViewProps) {
  // 1. Hooks
  useRoadmapProgress(materialId, content.phases);

  // 2. State
  const [selectedTopic, setSelectedTopic] = useState<RoadmapTopic | null>(null);

  // 3. Derived Values

  // 4. Memoized Values

  // 5. Event Handlers
  const handleStudyPhaseInChat = (phase: RoadmapPhase, phaseIndex: number) => {
    const promptText = buildPhaseStudyPrompt(phase, phaseIndex, content.title);
    dispatchChatPrompt(promptText);
  };

  const handleExplainTopicInChat = (topic: RoadmapTopic) => {
    const promptText = buildTopicExplainPrompt(topic, content.title);
    dispatchChatPrompt(promptText);
    setSelectedTopic(null);
  };

  const handleSelectTopic = (topic: RoadmapTopic) => {
    setSelectedTopic(topic);
  };

  const handleCloseModal = () => {
    setSelectedTopic(null);
  };

  // 6. Render
  return (
    <div className="roadmap-view @container flex flex-col items-center gap-6 @sm:gap-8 @3xl:gap-10 w-full max-w-4xl mx-auto animate-in fade-in duration-300 pb-20 select-none px-3 @sm:px-4">
      <RoadmapHeader title={content.title} description={content.description} />

      <RoadmapSpine
        phases={content.phases}
        onStudyPhase={handleStudyPhaseInChat}
        onSelectTopic={handleSelectTopic}
      />

      <TopicDetailModal
        topic={selectedTopic}
        onClose={handleCloseModal}
        onExplainInChat={handleExplainTopicInChat}
      />
    </div>
  );
}

// =============================================================================
// Export
// =============================================================================

export default RoadmapView;
