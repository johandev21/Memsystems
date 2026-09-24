import type {
  StudyGuideGenerationOptions,
  CaseStudyGenerationOptions,
} from "@/features/study-material-viewer";
import type { StudyMaterialKind } from "@/features/study-material-viewer";
import {
  type ApiErrorResponse,
  createApiErrorMessage,
  getApiUrl,
  resolveApiErrorMessage,
} from "@/shared/api";
import { isStructuredOutputMessageKey } from "@/features/ai";

export type { StudyMaterialKind };

export interface RoadmapGenerationOptions {
  /** 0 = auto. */
  phaseCount: number;
  detailLevel: "basic" | "detailed" | "auto";
}

export interface MindMapGenerationOptions {
  /** 0 = auto. */
  nodeCount: number;
  structure: "radial" | "hierarchical" | "organic";
  colorGroups: boolean | "auto";
  crossLinks: boolean;
  detailLevel: "basic" | "detailed" | "auto";
}

export interface SlidesGenerationOptions {
  /** 0 = auto. */
  slideCount: number;
  theme: "dark" | "light" | "accent" | "editorial" | "academic" | "technical" | "warm" | "auto";
  detailLevel: "basic" | "detailed" | "auto";
}

export interface PracticeProblemsGenerationOptions {
  /** 0 = auto. */
  problemCount: number;
  difficulty: "easy" | "medium" | "hard" | "auto";
}

export interface CaseStudyGenerationOptionsInput {
  /** 0 = auto. */
  questionCount: number;
  focus: string;
  comparePerspectives: "auto" | "single" | "compare";
}

export interface StartGenerationInput {
  kind: StudyMaterialKind;
  brief: string;
  sourceIds: string[];
  folderId?: string | null;
  model?: string;
  /** 0 = auto. */
  questionCount?: number;
  difficulty?: "easy" | "medium" | "hard" | "auto";
  cardStyle?: "qa" | "definition" | "cloze" | "mixed" | "auto";
  roadmapOptions?: RoadmapGenerationOptions;
  mindMapOptions?: MindMapGenerationOptions;
  studyGuideOptions?: StudyGuideGenerationOptions;
  practiceProblemsOptions?: PracticeProblemsGenerationOptions;
  caseStudyOptions?: CaseStudyGenerationOptions | CaseStudyGenerationOptionsInput;
  slidesOptions?: SlidesGenerationOptions;
  language?: string;
}

export type GenerationEvent =
  | { type: "partial"; content: unknown }
  | { type: "done"; requestId: string; materialId?: string }
  | { type: "error"; error: Error };

export interface StartGenerationResult {
  stream: AsyncIterable<GenerationEvent>;
  requestIdPromise: Promise<string>;
  abort: () => void;
}

export function startGeneration(
  notebookId: string,
  input: StartGenerationInput,
): StartGenerationResult {
  const controller = new AbortController();
  const promise = fetch(getApiUrl(`/api/notebooks/${notebookId}/generate`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as ApiErrorResponse;
      // Keep the structured-output preflight key intact so classification can
      // surface the capability block; resolve every other backend message.
      const messageKey = isStructuredOutputMessageKey(data.error)
        ? data.error
        : isStructuredOutputMessageKey(data.messageKey)
          ? data.messageKey
          : null;
      if (messageKey) throw new Error(messageKey);
      throw new Error(
        resolveApiErrorMessage(data, createApiErrorMessage(response, `Generation failed (${response.status})`)),
      );
    }
    return response;
  });

  const requestIdPromise = promise.then(
    (res) => res.headers.get("X-Request-Id") ?? res.headers.get("X-Generation-Request-Id") ?? "",
  );

  const stream: AsyncIterable<GenerationEvent> = {
    [Symbol.asyncIterator]() {
      return iteratorFrom(promise);
    },
  };

  return { stream, requestIdPromise, abort: () => controller.abort() };
}

async function* iteratorFrom(
  promise: Promise<Response>,
): AsyncGenerator<GenerationEvent, void, void> {
  let response: Response;
  try {
    response = await promise;
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err : new Error(String(err)),
    };
    return;
  }

  if (!response.body) {
    yield {
      type: "error",
      error: new Error("Generation response had no body"),
    };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          yield parseLine(line);
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }
    const trailing = buffer.trim();
    if (trailing.length > 0) {
      yield parseLine(trailing);
    }
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err : new Error(String(err)),
    };
  } finally {
    try {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

function parseLine(line: string): GenerationEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (err) {
    return {
      type: "error",
      error: new Error(
        `Failed to parse NDJSON line: ${err instanceof Error ? err.message : String(err)}`,
      ),
    };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "done" in parsed &&
    (parsed as { done: unknown }).done === true
  ) {
    const requestId = (parsed as { requestId?: string }).requestId ?? "";
    const materialId = (parsed as { materialId?: string }).materialId;
    return { type: "done", requestId, materialId };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as { error?: unknown }).error === "string"
  ) {
    return {
      type: "error",
      error: new Error((parsed as { error: string }).error),
    };
  }
  return { type: "partial", content: parsed };
}

export async function cancelGeneration(notebookId: string, requestId: string): Promise<void> {
  const response = await fetch(
    getApiUrl(`/api/notebooks/${notebookId}/generation-requests/${requestId}/cancel`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to cancel generation (${response.status})`);
  }
}
