import type { Folder, Notebook } from "./types";
import { SEEDED_NOTEBOOKS } from "./seed-notebooks";

// Deterministic prototype timestamps keep "last modified" sorting reproducible.
const NOTEBOOK_TIMESTAMPS: Record<string, { createdAt: string; updatedAt: string }> = {
  "seed-plato": { createdAt: "2026-01-12T09:00:00.000Z", updatedAt: "2026-08-03T09:00:00.000Z" },
  "seed-aristotle": {
    createdAt: "2026-01-18T09:00:00.000Z",
    updatedAt: "2026-07-27T09:00:00.000Z",
  },
  "seed-socrates": { createdAt: "2026-02-02T09:00:00.000Z", updatedAt: "2026-08-19T09:00:00.000Z" },
  "seed-kant": { createdAt: "2026-02-14T09:00:00.000Z", updatedAt: "2026-09-01T09:00:00.000Z" },
  "seed-descartes": {
    createdAt: "2026-02-21T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
  },
  "seed-confucio": { createdAt: "2026-03-05T09:00:00.000Z", updatedAt: "2026-07-14T09:00:00.000Z" },
  "seed-nietzsche": {
    createdAt: "2026-03-19T09:00:00.000Z",
    updatedAt: "2026-09-04T09:00:00.000Z",
  },
  "seed-locke": { createdAt: "2026-04-02T09:00:00.000Z", updatedAt: "2026-06-30T09:00:00.000Z" },
  "seed-hume": { createdAt: "2026-04-16T09:00:00.000Z", updatedAt: "2026-08-09T09:00:00.000Z" },
  "seed-marx": { createdAt: "2026-05-07T09:00:00.000Z", updatedAt: "2026-07-21T09:00:00.000Z" },
};

// Folder occupancy mirrors the exported design while all notebook content comes
// from the repository seed. The empty folder remains useful for testing states.
export const SAMPLE_FOLDERS: Folder[] = [
  {
    id: "folder-empty",
    name: "Empty folder",
    parentId: null,
    createdAt: "2026-05-20T09:00:00.000Z",
    updatedAt: "2026-05-20T09:00:00.000Z",
  },
  {
    id: "folder-many",
    name: "Modern Philosophy",
    parentId: null,
    createdAt: "2026-01-10T09:00:00.000Z",
    updatedAt: "2026-08-28T09:00:00.000Z",
  },
  {
    id: "folder-two",
    name: "Classical Philosophy",
    parentId: null,
    createdAt: "2026-01-15T09:00:00.000Z",
    updatedAt: "2026-08-14T09:00:00.000Z",
  },
  {
    id: "folder-one",
    name: "Aristotle",
    parentId: "folder-two",
    createdAt: "2026-01-20T09:00:00.000Z",
    updatedAt: "2026-07-30T09:00:00.000Z",
  },
];

export const SAMPLE_NOTEBOOKS: Notebook[] = SEEDED_NOTEBOOKS.map((notebook) => {
  const timestamps = NOTEBOOK_TIMESTAMPS[notebook.id] ?? {
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
  };
  return { ...notebook, ...timestamps };
});
