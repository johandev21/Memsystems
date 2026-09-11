import {
  BezierEdge,
  Handle,
  Position,
  type Edge,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/cn";
import type { MindMapFlowNode } from "./mind-map-types";

export function MindMapNode({ data }: NodeProps<MindMapFlowNode>) {
  const { t } = useTranslation("viewer");
  const isRoot = data.depth === 0;
  const hasChildren = data.item.children.length > 0;

  return (
    <div
      style={data.item.color ? { borderLeftColor: data.item.color, borderLeftWidth: 4 } : undefined}
      className={cn(
        "group relative min-w-[150px] max-w-[190px] sm:min-w-[190px] sm:max-w-[230px] rounded-lg border bg-surface-2 border-surface-border-subtle px-3 sm:px-4 py-2.5 sm:py-3 text-left text-text-primary transition-all duration-200",
        isRoot &&
          "min-w-[170px] sm:min-w-[210px] rounded-full border-surface-border bg-surface-3 text-text-primary",
        data.selected && !isRoot && "bg-surface-3 border-surface-border",
        !data.selected && !isRoot && "hover:bg-surface-3 hover:border-surface-border",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />
      <div className="flex items-center gap-2">
        <span className="text-sm sm:text-sm font-semibold leading-tight wrap-break-words">
          {data.item.label}
        </span>
      </div>

      {hasChildren && (
        <button
          type="button"
          aria-label={
            data.expanded
              ? t("mindMap.collapse", { label: data.item.label })
              : t("mindMap.expand", { label: data.item.label })
          }
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle(data.item.id);
          }}
          className="absolute -right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-surface-border-strong bg-surface-2 text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", data.expanded && "rotate-90")}
          />
        </button>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1 !w-1 !border-0 !bg-transparent"
      />
    </div>
  );
}

export function HighlightEdge(props: EdgeProps<Edge>) {
  return <BezierEdge {...props} />;
}


