import { z } from "zod";

export const MindMapNode = z.object({
  id: z.string(),
  label: z.string().min(1).max(500),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .default(null),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .nullable()
    .default(null),
});

export const MindMapEdge = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  label: z.string().max(200).nullable().default(null),
  directed: z.boolean().nullable().default(null),
});

export const MindMapContent = z.object({
  title: z.string().max(200).optional(),
  rootId: z.string().nullable().default(null),
  nodes: z.array(MindMapNode).min(1).max(500),
  edges: z.array(MindMapEdge).max(2000),
});

export type MindMapContentType = z.infer<typeof MindMapContent>;
