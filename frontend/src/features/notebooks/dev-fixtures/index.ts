import {
  worstCaseNotebook,
  worstCaseSources,
  worstCaseSourceFolders,
  worstCaseStudyMaterials,
  worstCaseStudyMaterialFolders,
  worstCaseChatMessages,
} from "./worst-case";
import {
  emptyCaseNotebook,
  emptyCaseSources,
  emptyCaseSourceFolders,
  emptyCaseStudyMaterials,
  emptyCaseStudyMaterialFolders,
  emptyCaseChatMessages,
} from "./empty-case";
import {
  oneCaseNotebook,
  oneCaseSources,
  oneCaseSourceFolders,
  oneCaseStudyMaterials,
  oneCaseStudyMaterialFolders,
  oneCaseChatMessages,
} from "./one-case";
import {
  hugeCaseNotebook,
  hugeCaseSources,
  hugeCaseSourceFolders,
  hugeCaseStudyMaterials,
  hugeCaseStudyMaterialFolders,
  hugeCaseChatMessages,
} from "./huge-case";

export type BreakUiMode = "demo" | "worst" | "empty" | "one" | "huge";

export interface BreakUiDataset {
  notebook: typeof worstCaseNotebook;
  sources: typeof worstCaseSources;
  sourceFolders: typeof worstCaseSourceFolders;
  studyMaterials: typeof worstCaseStudyMaterials;
  studyMaterialFolders: typeof worstCaseStudyMaterialFolders;
  chatMessages: typeof worstCaseChatMessages;
}

// In-memory clones to allow mutable edits during dev testing
let currentDatasets: Record<Exclude<BreakUiMode, "demo">, BreakUiDataset> = {
  worst: {
    notebook: { ...worstCaseNotebook },
    sources: [...worstCaseSources],
    sourceFolders: [...worstCaseSourceFolders],
    studyMaterials: [...worstCaseStudyMaterials],
    studyMaterialFolders: [...worstCaseStudyMaterialFolders],
    chatMessages: [...worstCaseChatMessages],
  },
  empty: {
    notebook: { ...emptyCaseNotebook },
    sources: [...emptyCaseSources],
    sourceFolders: [...emptyCaseSourceFolders],
    studyMaterials: [...emptyCaseStudyMaterials],
    studyMaterialFolders: [...emptyCaseStudyMaterialFolders],
    chatMessages: [...emptyCaseChatMessages],
  },
  one: {
    notebook: { ...oneCaseNotebook },
    sources: [...oneCaseSources],
    sourceFolders: [...oneCaseSourceFolders],
    studyMaterials: [...oneCaseStudyMaterials],
    studyMaterialFolders: [...oneCaseStudyMaterialFolders],
    chatMessages: [...oneCaseChatMessages],
  },
  huge: {
    notebook: { ...hugeCaseNotebook },
    sources: [...hugeCaseSources],
    sourceFolders: [...hugeCaseSourceFolders],
    studyMaterials: [...hugeCaseStudyMaterials],
    studyMaterialFolders: [...hugeCaseStudyMaterialFolders],
    chatMessages: [...hugeCaseChatMessages],
  },
};

export function getBreakUiMode(): BreakUiMode {
  if (typeof window === "undefined") return "demo";
  const param = new URLSearchParams(window.location.search).get("data");
  if (param === "worst" || param === "empty" || param === "one" || param === "huge") {
    return param;
  }
  return "demo";
}

export function handleDevBreakUiMock(path: string, init?: RequestInit): Response | null {
  if (typeof window === "undefined") return null;
  const mode = getBreakUiMode();
  if (mode === "demo") return null;

  const dataset = currentDatasets[mode];
  if (!dataset) return null;

  const method = init?.method?.toUpperCase() ?? "GET";
  const cleanPath = path.split("?")[0];

  // 1. Notebook Chat: GET /api/notebooks/:id/chat
  if (cleanPath.match(/^\/api\/notebooks\/[^/]+\/chat$/)) {
    if (method === "GET") {
      return new Response(JSON.stringify(dataset.chatMessages), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "DELETE") {
      dataset.chatMessages = [];
      return new Response(null, { status: 204 });
    }
  }

  // 2. Sources: GET /api/notebooks/:id/sources
  if (cleanPath.match(/^\/api\/notebooks\/[^/]+\/sources$/)) {
    return new Response(JSON.stringify(dataset.sources), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Source Folders: GET /api/notebooks/:id/source-folders
  if (cleanPath.match(/^\/api\/notebooks\/[^/]+\/source-folders$/)) {
    return new Response(JSON.stringify(dataset.sourceFolders), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Study Materials: GET /api/notebooks/:id/study-materials
  if (cleanPath.match(/^\/api\/notebooks\/[^/]+\/study-materials$/)) {
    return new Response(JSON.stringify(dataset.studyMaterials), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Study Material Folders: GET /api/notebooks/:id/folders
  if (cleanPath.match(/^\/api\/notebooks\/[^/]+\/folders$/)) {
    return new Response(JSON.stringify(dataset.studyMaterialFolders), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6. Single Source: GET /api/sources/:sourceId
  if (cleanPath.match(/^\/api\/sources\/[^/]+$/)) {
    const sourceId = cleanPath.split("/").pop();
    const found = dataset.sources.find((s) => s.id === sourceId);
    if (found) {
      const fullSource = {
        ...found,
        rawText: `Worst-case raw text content for ${found.title}.\n\nContains long URLs: https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved\n\nAnd emails: bartholomew.fitzgerald@northwind-industries-holdings.example.com`,
        s3Key: null,
        sha256: null,
      };
      return new Response(JSON.stringify(fullSource), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 7. Single Study Material: GET /api/study-materials/:materialId
  if (cleanPath.match(/^\/api\/study-materials\/[^/]+$/)) {
    const materialId = cleanPath.split("/").pop();
    const found = dataset.studyMaterials.find((m) => m.id === materialId);
    if (found) {
      return new Response(JSON.stringify(found), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 8. Notebook Details: GET/PATCH /api/notebooks/:id
  if (cleanPath.match(/^\/api\/notebooks\/[^/]+$/)) {
    if (method === "GET") {
      return new Response(JSON.stringify(dataset.notebook), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (method === "PATCH") {
      try {
        const body = JSON.parse((init?.body as string) || "{}");
        dataset.notebook = { ...dataset.notebook, ...body, updatedAt: new Date().toISOString() };
        return new Response(JSON.stringify(dataset.notebook), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify(dataset.notebook), { status: 200 });
      }
    }
  }

  return null;
}
