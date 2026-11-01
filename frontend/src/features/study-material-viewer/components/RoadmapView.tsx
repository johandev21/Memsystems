import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MindMapControls } from "./mind-map/mind-map-controls";
import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";
import i18n from "@/shared/i18n";
import { formatDisplayTitle } from "../utils/format-title";
import {
  useRoadmapProgress,
  type RoadmapPhase,
  type RoadmapTopic,
} from "../hooks/use-roadmap-progress";
import type { RoadmapContentType } from "../shapes/roadmap";

export type RoadmapContent = RoadmapContentType;

export interface RoadmapViewProps {
  materialId: string;
  content: RoadmapContent;
}

export function RoadmapView({ materialId, content }: RoadmapViewProps) {
  useRoadmapProgress(materialId, content.phases);

  const handleStudyPhaseInChat = useCallback(
    (phase: RoadmapPhase, phaseIndex: number) => {
      const promptText = buildPhaseStudyPrompt(phase, phaseIndex, content.title);
      dispatchChatPrompt(promptText);
    },
    [content.title],
  );

  return (
    <div className="@container flex flex-col items-center gap-6 w-full mx-auto pb-safe px-3 @sm:px-4">
      {content.description && (
        <p className="max-w-2xl px-2 text-center text-xs leading-relaxed text-text-secondary @sm:text-sm @3xl:text-base">
          {content.description}
        </p>
      )}

      <ReactFlowProvider>
        <RoadmapCanvas phases={content.phases} onStudyPhase={handleStudyPhaseInChat} />
      </ReactFlowProvider>
    </div>
  );
}

export default RoadmapView;

interface PhaseMilestoneCardProps {
  phase: RoadmapPhase;
  phaseIndex: number;
  onStudyPhase: (phase: RoadmapPhase, phaseIndex: number) => void;
  selected: boolean;
}

interface TopicCardProps {
  topic: RoadmapTopic;
  isLeft: boolean;
  selected: boolean;
}

type RoadmapGraphNode = Node<
  | {
      kind: "phase";
      phase: RoadmapPhase;
      phaseIndex: number;
      onStudyPhase: (phase: RoadmapPhase, index: number) => void;
    }
  | { kind: "topic"; topic: RoadmapTopic },
  "roadmap"
>;

const SEND_CHAT_PROMPT_EVENT = "send-chat-prompt";

const roadmapNodeTypes = { roadmap: RoadmapGraphCard };

function RoadmapGraphCard({ data, selected }: NodeProps<RoadmapGraphNode>) {
  return (
    <div className="@container">
      <Handle type="target" position={Position.Top} id="top" className="!opacity-0" />
      <Handle type="target" position={Position.Left} id="left" className="!opacity-0" />
      <Handle type="target" position={Position.Right} id="right" className="!opacity-0" />
      {data.kind === "phase" ? (
        <PhaseMilestoneCard
          phase={data.phase}
          phaseIndex={data.phaseIndex}
          onStudyPhase={data.onStudyPhase}
          selected={selected}
        />
      ) : (
        <TopicCard topic={data.topic} isLeft={false} selected={selected} />
      )}
      <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="!opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="!opacity-0" />
    </div>
  );
}

export function arrangeRoadmap(nodes: RoadmapGraphNode[]): RoadmapGraphNode[] {
  let y = 0;
  const positions = new Map<string, { x: number; y: number }>();
  const phases = nodes.filter((node) => node.data.kind === "phase");
  phases.forEach((phase) => {
    const data = phase.data;
    if (data.kind !== "phase") return;
    positions.set(phase.id, { x: 340, y });
    const topics = nodes.filter(
      (node) => node.data.kind === "topic" && node.id.startsWith(`topic-${data.phaseIndex}-`),
    );
    let rowY = y + (phase.measured?.height ?? 220) + 45;
    for (let i = 0; i < topics.length; i += 2) {
      positions.set(topics[i].id, { x: 0, y: rowY });
      if (topics[i + 1]) positions.set(topics[i + 1].id, { x: 780, y: rowY });
      rowY +=
        Math.max(topics[i].measured?.height ?? 150, topics[i + 1]?.measured?.height ?? 0) + 28;
    }
    y = rowY + 55;
  });
  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
}

function RoadmapCanvas({
  phases,
  onStudyPhase,
}: {
  phases: RoadmapPhase[];
  onStudyPhase: (phase: RoadmapPhase, index: number) => void;
}) {
  const { t } = useTranslation("viewer");
  const graph = useMemo(() => {
    const nodes: RoadmapGraphNode[] = [];
    const edges: Edge[] = [];
    phases.forEach((phase, phaseIndex) => {
      const phaseId = `phase-${phaseIndex}`;
      nodes.push({
        id: phaseId,
        type: "roadmap",
        position: { x: 0, y: 0 },
        style: { width: 400, pointerEvents: "all" },
        className:
          "rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        data: { kind: "phase", phase, phaseIndex, onStudyPhase },
        draggable: false,
      });
      if (phaseIndex > 0)
        edges.push({
          id: `spine-${phaseIndex}`,
          source: `phase-${phaseIndex - 1}`,
          sourceHandle: "bottom",
          target: phaseId,
          targetHandle: "top",
          type: "straight",
          style: { stroke: "var(--surface-border)", strokeWidth: 2 },
        });
      phase.topics.forEach((topic, topicIndex) => {
        const id = `topic-${phaseIndex}-${topicIndex}`;
        const left = topicIndex % 2 === 0;
        nodes.push({
          id,
          type: "roadmap",
          position: { x: 0, y: 0 },
          style: { width: 300, pointerEvents: "all" },
          className:
            "rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          data: { kind: "topic", topic },
          draggable: false,
        });
        edges.push({
          id: `edge-${id}`,
          source: phaseId,
          sourceHandle: left ? "left-source" : "right-source",
          target: id,
          targetHandle: left ? "right" : "left",
          type: "smoothstep",
          style: {
            stroke: "var(--color-primary)",
            strokeOpacity: 0.45,
            strokeWidth: 2,
            strokeDasharray: "3 6",
          },
        });
      });
    });
    return { nodes: arrangeRoadmap(nodes), edges };
  }, [phases, onStudyPhase]);
  const [nodes, setNodes] = useState(graph.nodes);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const selectedNode = nodes.find((node) => node.selected);
  const initialized = useNodesInitialized();
  const didFit = useRef(false);
  useEffect(() => {
    setNodes(graph.nodes);
    didFit.current = false;
  }, [graph]);
  const onNodesChange = useCallback((changes: NodeChange<RoadmapGraphNode>[]) => {
    setNodes((current) => arrangeRoadmap(applyNodeChanges(changes, current)));
  }, []);
  useEffect(() => {
    if (!initialized || didFit.current) return;
    didFit.current = true;
    void fitView({
      nodes: nodes.filter(
        (node) => node.id === "phase-0" || node.id === "topic-0-0" || node.id === "topic-0-1",
      ),
      padding: 0.25,
      maxZoom: 1,
    });
  }, [initialized, fitView, nodes]);
  const duration = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300);
  return (
    <div className="relative h-[min(520px,calc(100dvh-160px))] min-h-105 w-full overflow-hidden sm:h-[min(680px,calc(100dvh-180px))]">
      <ReactFlow<RoadmapGraphNode>
        nodes={nodes}
        edges={graph.edges}
        nodeTypes={roadmapNodeTypes}
        onNodesChange={onNodesChange}
        noDragClassName="touch-manipulation"
        noPanClassName="touch-manipulation"
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.01}
        maxZoom={1.7}
        panOnDrag
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--surface-border)"
        />
      </ReactFlow>
      <MindMapControls
        onZoomIn={() => {
          void zoomIn({ duration: duration() });
        }}
        onZoomOut={() => {
          void zoomOut({ duration: duration() });
        }}
        centerLabel={selectedNode ? t("mindMap.center") : t("roadmap.fitRoadmap")}
        onCenter={() => {
          void fitView({
            ...(selectedNode ? { nodes: [{ id: selectedNode.id }] } : {}),
            padding: 0.2,
            maxZoom: selectedNode ? 1.4 : 1,
            duration: duration(),
          });
        }}
      />
    </div>
  );
}

function PhaseMilestoneCard({
  phase,
  phaseIndex,
  onStudyPhase,
  selected,
}: PhaseMilestoneCardProps) {
  const { t } = useTranslation("viewer");

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface-2 p-4 @sm:p-5 @3xl:p-6 max-w-full sm:max-w-lg w-full text-center flex flex-col items-center gap-2.5",
        selected ? "border-primary/70" : "border-surface-border-subtle",
      )}
    >
      <Badge
        variant="default"
        className="bg-primary text-primary-foreground border-primary text-xs font-semibold px-2.5 py-0.5"
      >
        {formatMilestoneLabel(phaseIndex)}
      </Badge>

      <h3 className="text-sm sm:text-base @sm:text-lg @3xl:text-xl font-extrabold text-text-primary tracking-tight leading-snug wrap-break-word">
        {formatDisplayTitle(phase.title)}
      </h3>

      {phase.description && (
        <p className="text-text-secondary text-xs @sm:text-sm leading-relaxed wrap-break-word">
          {phase.description}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          onStudyPhase(phase, phaseIndex);
        }}
        className="mt-1 min-h-11 sm:min-h-8 sm:h-8 px-3.5 @sm:px-4 rounded-xl border border-surface-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3 text-xs @sm:text-sm font-medium cursor-pointer transition-colors touch-manipulation active:scale-97"
      >
        {t("roadmap.studyInChat")}
      </Button>
    </div>
  );
}

function TopicCard({ topic, isLeft, selected }: TopicCardProps) {
  const { t } = useTranslation("viewer");
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
      toast.success(t("roadmap.copied"));
      timeoutRef.current = window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      toast.error(t("roadmap.copyFailed"));
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full",
        isLeft ? "@3xl:justify-end @3xl:pr-6" : "@3xl:justify-start @3xl:pl-6",
      )}
    >
      <div
        className={cn(
          "hidden @3xl:block absolute top-1/2 border-t-2 border-dashed border-primary/40 z-0 w-6",
          isLeft ? "-right-0" : "-left-0",
        )}
      />

      <div
        className={cn(
          "group relative rounded-xl border bg-surface-2 p-3.5 @sm:p-4 @3xl:p-5 flex flex-col gap-1.5 @sm:gap-2 w-full max-w-full @3xl:max-w-sm z-10",
          selected ? "border-primary/70" : "border-surface-border-subtle",
        )}
      >
        <h4 className="text-xs sm:text-sm @sm:text-base font-bold text-text-tertiary leading-snug wrap-break-word">
          {formatDisplayTitle(topic.title)}
        </h4>

        {topic.description && (
          <p className="text-text-secondary text-xs @sm:text-sm leading-relaxed wrap-break-word">
            {topic.description}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            void handleCopy();
          }}
          aria-label={t("roadmap.copyTopic", { title: formatDisplayTitle(topic.title) })}
          className="absolute top-2 right-2 min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 sm:size-7 text-text-faint hover:text-text-secondary opacity-100 sm:opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100 touch-manipulation active:scale-97 cursor-pointer"
        >
          {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function formatMilestoneLabel(phaseIndex: number): string {
  return i18n.t("roadmap.phase", { ns: "viewer", number: phaseIndex + 1 });
}

function formatTopicSummary(topics: RoadmapTopic[]): string {
  return topics
    .map(
      (topic, index) =>
        `${index + 1}. **${formatDisplayTitle(topic.title)}**${topic.description ? `: ${topic.description}` : ""}`,
    )
    .join("\n");
}

function buildPhaseStudyPrompt(
  phase: RoadmapPhase,
  phaseIndex: number,
  roadmapTitle?: string,
): string {
  const formattedPhaseTitle = formatDisplayTitle(phase.title);
  const topicSummary = formatTopicSummary(phase.topics);
  const roadmapContext = roadmapTitle
    ? i18n.t("roadmap.prompt.context", { ns: "viewer", title: formatDisplayTitle(roadmapTitle) })
    : "";

  return i18n.t("roadmap.prompt.study", {
    ns: "viewer",
    number: phaseIndex + 1,
    title: formattedPhaseTitle,
    roadmapContext,
    description: phase.description || i18n.t("roadmap.prompt.notAvailable", { ns: "viewer" }),
    topics: topicSummary,
  });
}

function buildTopicCopyText(topic: RoadmapTopic): string {
  const lines: string[] = [formatDisplayTitle(topic.title)];
  if (topic.description) {
    lines.push("", topic.description);
  }
  if (topic.keyTakeaways?.length) {
    lines.push("", i18n.t("roadmap.keyObjectives", { ns: "viewer" }));
    topic.keyTakeaways.forEach((keyPoint) => lines.push(`- ${keyPoint}`));
  }
  return lines.join("\n");
}

function dispatchChatPrompt(promptText: string): void {
  window.dispatchEvent(
    new CustomEvent(SEND_CHAT_PROMPT_EVENT, {
      detail: { prompt: promptText, autoSend: false, focusChat: true },
    }),
  );
}
