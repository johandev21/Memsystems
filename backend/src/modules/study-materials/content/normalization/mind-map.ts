import { citationsField, isRecord, stringify, toArray } from './value-readers';

export type NormalizedMindMapNode = {
  id: string;
  label: string;
  color: string;
  position: { x: number; y: number };
};
export type NormalizedMindMapEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  directed: boolean;
};
export type NormalizedMindMapContent = {
  title: string;
  rootId: string;
  nodes: NormalizedMindMapNode[];
  edges: NormalizedMindMapEdge[];
  citations: unknown[];
};

export function normalizeMindMapContent(
  content: unknown,
): NormalizedMindMapContent {
  const record = isRecord(content) ? content : {};
  const nodes: unknown[] = toArray(record.nodes);
  const edges: unknown[] = toArray(record.edges);

  const normalizedNodes = nodes.map((n, nIndex): NormalizedMindMapNode => {
    if (!isRecord(n)) {
      return {
        id: `node-${nIndex}`,
        label: stringify(n),
        color: '#64748b',
        position: { x: 0, y: 0 },
      };
    }
    return {
      id:
        typeof n.id === 'string'
          ? n.id
          : `node-${nIndex}-${Math.random().toString(36).substring(7)}`,
      label: stringify(n.label ?? n.title ?? n.text ?? 'Concept'),
      color:
        typeof n.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(n.color)
          ? n.color
          : '#64748b',
      position:
        isRecord(n.position) &&
        typeof n.position.x === 'number' &&
        typeof n.position.y === 'number'
          ? { x: n.position.x, y: n.position.y }
          : { x: 0, y: 0 },
    };
  });

  const normalizedEdges = edges
    .map((e, eIndex): NormalizedMindMapEdge | null => {
      if (!isRecord(e)) {
        return null;
      }
      return {
        id:
          typeof e.id === 'string'
            ? e.id
            : `edge-${eIndex}-${Math.random().toString(36).substring(7)}`,
        sourceId: stringify(e.sourceId ?? e.source ?? ''),
        targetId: stringify(e.targetId ?? e.target ?? ''),
        label: typeof e.label === 'string' ? e.label : '',
        directed: typeof e.directed === 'boolean' ? e.directed : true,
      };
    })
    .filter((e): e is NormalizedMindMapEdge => e !== null);

  return {
    title:
      isRecord(content) && content.title
        ? stringify(content.title)
        : 'mind-map',
    rootId:
      isRecord(content) && typeof content.rootId === 'string'
        ? content.rootId
        : (normalizedNodes[0]?.id ?? ''),
    nodes: normalizedNodes,
    edges: normalizedEdges,
    citations: citationsField(content),
  };
}
