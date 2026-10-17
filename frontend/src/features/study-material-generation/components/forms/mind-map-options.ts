import type { MindMapOptions } from "./types";

export const NODE_PRESETS = [10, 20, 30];
export const MAX_NODE_COUNT = 100;
export const CUSTOM_NODE_DEFAULT = 40;

export const DEFAULT_MIND_MAP_OPTIONS: MindMapOptions = {
  nodeCount: 20,
  structure: "hierarchical",
  colorGroups: false,
  crossLinks: false,
  detailLevel: "basic",
};
