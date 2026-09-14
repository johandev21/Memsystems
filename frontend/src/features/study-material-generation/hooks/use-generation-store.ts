import type {
  StudyGuideGenerationOptions,
  CaseStudyGenerationOptions,
} from "@/features/study-material-viewer";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";
import { cancelGeneration, type StudyMaterialKind, startGeneration } from "../api/generation";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";
import type {
  RoadmapGenerationOptions,
  MindMapGenerationOptions,
  SlidesGenerationOptions,
  PracticeProblemsGenerationOptions,
} from "../api/generation";
import { classifyChatError } from "@/features/ai";
import i18n from "@/shared/i18n";
import { kindLabelKey } from "../kind-label";

export interface ActiveGeneration {
  id: string;
  notebookId: string;
  kind: StudyMaterialKind;
  brief: string;
  sourceIds?: string[];
  status: "connecting" | "streaming" | "done" | "error";
  progress?: unknown;
  error?: string;
  startedAt: number;
  lastChunkAt: number;
  onComplete?: (materialId: string) => void;
}

interface GenerationState {
  generations: Record<string, ActiveGeneration>;
  isCollapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  startBackgroundGeneration: (
    notebookId: string,
    input: {
      kind: StudyMaterialKind;
      brief: string;
      sourceIds: string[];
      folderId: string | null;
      model?: string;
      questionCount?: number;
      difficulty?: "easy" | "medium" | "hard";
      cardStyle?: "qa" | "definition" | "cloze" | "mixed";
      roadmapOptions?: RoadmapGenerationOptions;
      mindMapOptions?: MindMapGenerationOptions;
      studyGuideOptions?: StudyGuideGenerationOptions;
      practiceProblemsOptions?: PracticeProblemsGenerationOptions;
      caseStudyOptions?: CaseStudyGenerationOptions;
      slidesOptions?: SlidesGenerationOptions;
      language?: string;
    },
    queryClient: QueryClient,
    onComplete?: (materialId: string) => void,
  ) => Promise<void>;
  cancelBackgroundGeneration: (notebookId: string, id: string) => Promise<void>;
  dismissGeneration: (id: string) => void;
}

export const GENERATION_STALL_TIMEOUT_MS = 5 * 60 * 1000;
export const GENERATION_ERROR_AUTO_DISMISS_MS = 30_000;

function activeBaseLanguage(): string {
  return (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0];
}

function createTempGenerationId(): string {
  return `temp-${Math.random().toString(36).substring(7)}-${Date.now()}`;
}

function removeGeneration(generations: Record<string, ActiveGeneration>, id: string) {
  const next = { ...generations };
  delete next[id];
  return next;
}

function updateGenerationError(
  generations: Record<string, ActiveGeneration>,
  id: string,
  error: string,
) {
  if (!generations[id]) return generations;
  return { ...generations, [id]: { ...generations[id], status: "error" as const, error } };
}

export const useGenerationStore = create<GenerationState>((set, get) => {
  const stallTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const errorDismissTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const activeAborts = new Map<string, () => void>();

  function clearStallTimer(id: string) {
    const timer = stallTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      stallTimers.delete(id);
    }
  }

  function clearErrorDismissTimer(id: string) {
    const timer = errorDismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      errorDismissTimers.delete(id);
    }
  }

  function removeAndClear(id: string) {
    clearStallTimer(id);
    clearErrorDismissTimer(id);
    set((state) => ({ generations: removeGeneration(state.generations, id) }));
  }

  function scheduleErrorDismiss(id: string) {
    clearErrorDismissTimer(id);
    errorDismissTimers.set(
      id,
      setTimeout(() => {
        errorDismissTimers.delete(id);
        // Only auto-dismiss error entries; leave active generations alone.
        if (get().generations[id]?.status === "error") {
          clearStallTimer(id);
          set((state) => {
            if (state.generations[id]?.status !== "error") return state;
            return { generations: removeGeneration(state.generations, id) };
          });
        }
      }, GENERATION_ERROR_AUTO_DISMISS_MS),
    );
  }

  function failGeneration(id: string, kind: StudyMaterialKind, message: string) {
    const entry = get().generations[id];
    if (!entry) return;
    if (entry.status !== "connecting" && entry.status !== "streaming") return;
    clearStallTimer(id);
    set((state) => ({
      generations: updateGenerationError(state.generations, id, message),
    }));
    toast.error(
      i18n.t("toasts.failed", {
        ns: "generation",
        kind: kindLabel(kind),
        message,
      }),
    );
    scheduleErrorDismiss(id);
  }

  function scheduleStallCheck(id: string, kind: StudyMaterialKind) {
    clearStallTimer(id);
    stallTimers.set(
      id,
      setTimeout(() => {
        const entry = get().generations[id];
        if (!entry) {
          stallTimers.delete(id);
          return;
        }
        if (entry.status !== "connecting" && entry.status !== "streaming") {
          stallTimers.delete(id);
          return;
        }
        if (Date.now() - entry.lastChunkAt >= GENERATION_STALL_TIMEOUT_MS) {
          failGeneration(
            id,
            kind,
            i18n.t("errors.timedOut", { ns: "generation" }),
          );
        } else {
          // Chunk arrived recently; re-arm for the remaining time.
          scheduleStallCheck(id, kind);
        }
      }, GENERATION_STALL_TIMEOUT_MS),
    );
  }

  return {
    generations: {},
    isCollapsed: false,
    setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),

    startBackgroundGeneration: async (notebookId, input, queryClient, onComplete) => {
      const tempId = createTempGenerationId();
      const now = Date.now();

      set((state) => ({
        generations: {
          ...state.generations,
          [tempId]: {
            id: tempId,
            notebookId,
            kind: input.kind,
            brief: input.brief,
            sourceIds: input.sourceIds,
            status: "connecting",
            startedAt: now,
            lastChunkAt: now,
            onComplete,
          },
        },
      }));
      scheduleStallCheck(tempId, input.kind);

      const { stream, requestIdPromise, abort } = startGeneration(notebookId, {
        ...input,
        language: activeBaseLanguage(),
      });
      activeAborts.set(tempId, abort);

      let requestId: string;
      try {
        requestId = await requestIdPromise;
        if (!requestId) {
          throw new Error(i18n.t("errors.noRequestId", { ns: "generation" }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        activeAborts.delete(tempId);
        clearStallTimer(tempId);
        set((state) => {
          return { generations: updateGenerationError(state.generations, tempId, msg) };
        });
        toast.error(i18n.t("toasts.startFailed", { ns: "generation", message: msg }));
        scheduleErrorDismiss(tempId);
        return;
      }

      if (!get().generations[tempId]) {
        activeAborts.get(tempId)?.();
        activeAborts.delete(tempId);
        clearStallTimer(tempId);
        try {
          await cancelGeneration(notebookId, requestId);
        } catch {
          // ignore cancellation failure
        }
        return;
      }

      const startedAt = get().generations[tempId]?.startedAt ?? Date.now();
      const swappedAt = Date.now();
      clearStallTimer(tempId);
      activeAborts.delete(tempId);
      activeAborts.set(requestId, abort);
      set((state) => {
        const next = removeGeneration(state.generations, tempId);
        next[requestId] = {
          id: requestId,
          notebookId,
          kind: input.kind,
          brief: input.brief,
          sourceIds: input.sourceIds,
          status: "streaming",
          startedAt,
          lastChunkAt: swappedAt,
          onComplete,
        };
        return { generations: next };
      });
      scheduleStallCheck(requestId, input.kind);

      (async () => {
        let settled = false;
        try {
          for await (const event of stream) {
            if (!get().generations[requestId]) {
              try {
                await cancelGeneration(notebookId, requestId);
              } catch {
                // ignore
              }
              return;
            }

            if (event.type === "partial") {
              const at = Date.now();
              set((state) => {
                if (!state.generations[requestId]) return state;
                return {
                  generations: {
                    ...state.generations,
                    [requestId]: {
                      ...state.generations[requestId],
                      status: "streaming",
                      progress: event.content,
                      lastChunkAt: at,
                    },
                  },
                };
              });
              scheduleStallCheck(requestId, input.kind);
            } else if (event.type === "done") {
              settled = true;
              activeAborts.delete(requestId);
              clearStallTimer(requestId);
              clearErrorDismissTimer(requestId);
              await queryClient.invalidateQueries({
                queryKey: ["study-materials", notebookId],
              });

              let viewMaterialId = event.materialId;

              if (!viewMaterialId) {
                const list =
                  queryClient.getQueryData<StudyMaterialDTO[]>(["study-materials", notebookId]) ||
                  [];
                const matching = list.filter((m) => m.kind === input.kind);
                matching.sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                );
                viewMaterialId = matching[0]?.id;
              }

              set((state) => {
                return { generations: removeGeneration(state.generations, requestId) };
              });

              const label = kindLabel(input.kind);
              toast.success(
                i18n.t("toasts.success", { ns: "generation", kind: label }),
                {
                  action:
                    viewMaterialId && onComplete
                      ? {
                          label: i18n.t("actions.view", { ns: "generation" }),
                          onClick: () => onComplete(viewMaterialId),
                        }
                      : undefined,
                  duration: 8000,
                },
              );
            } else if (event.type === "error") {
              settled = true;
              throw event.error;
            }
          }
          if (!settled && get().generations[requestId]) {
            activeAborts.delete(requestId);
            failGeneration(requestId, input.kind, i18n.t("errors.connectionClosed", { ns: "generation" }));
          }
        } catch (err) {
          activeAborts.delete(requestId);
          const rawMessage = err instanceof Error ? err.message : String(err);
          // Generation failures arrive as `{error, code[, model]}` envelopes
          // (or raw provider text) — classify to friendly copy so toasts never
          // show JSON or provider jargon. Synthetic client-side messages
          // (timeout / EOF) are already friendly, so they bypass classification.
          failGeneration(requestId, input.kind, classifyChatError(rawMessage).message);
        }
      })();
    },

    cancelBackgroundGeneration: async (notebookId, id) => {
      const isTemp = id.startsWith("temp-");
      activeAborts.get(id)?.();
      activeAborts.delete(id);
      removeAndClear(id);

      if (!isTemp) {
        try {
          await cancelGeneration(notebookId, id);
          toast.info(i18n.t("toasts.cancelled", { ns: "generation" }));
        } catch {
          // ignore
        }
      }
    },

    dismissGeneration: (id) => {
      removeAndClear(id);
    },
  };
});

function kindLabel(kind: StudyMaterialKind): string {
  return i18n.t(kindLabelKey(kind), { ns: "generation" });
}
