import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { create } from "zustand";
import { cancelGeneration, type StudyMaterialKind, startGeneration } from "../api/generation";
import type { StudyMaterialDTO } from "@/features/study-material-viewer";
import type { RoadmapGenerationOptions, MindMapGenerationOptions, SlidesGenerationOptions } from "../api/generation";
import { KIND_LABELS } from "@/features/study-material-viewer";
import { classifyChatError } from "@/features/notebook-chat/utils/chat-error";

export interface ActiveGeneration {
  id: string;
  notebookId: string;
  kind: StudyMaterialKind;
  brief: string;
  sourceIds?: string[];
  status: "connecting" | "streaming" | "done" | "error";
  progress?: unknown;
  error?: string;
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
      slidesOptions?: SlidesGenerationOptions;
    },
    queryClient: QueryClient,
    onComplete?: (materialId: string) => void,
  ) => Promise<void>;
  cancelBackgroundGeneration: (notebookId: string, id: string) => Promise<void>;
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

export const useGenerationStore = create<GenerationState>((set, get) => ({
  generations: {},
  isCollapsed: false,
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),

  startBackgroundGeneration: async (notebookId, input, queryClient, onComplete) => {
    const tempId = createTempGenerationId();

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
          onComplete,
        },
      },
    }));

    const { stream, requestIdPromise } = startGeneration(notebookId, input);

    let requestId: string;
    try {
      requestId = await requestIdPromise;
      if (!requestId) {
        throw new Error("No request ID returned from server");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      set((state) => {
        return { generations: updateGenerationError(state.generations, tempId, msg) };
      });
      toast.error(`Generation failed: ${msg}`);
      return;
    }

    if (!get().generations[tempId]) {
      try {
        await cancelGeneration(notebookId, requestId);
      } catch {
        // ignore cancellation failure
      }
      return;
    }

    set((state) => {
      const next = removeGeneration(state.generations, tempId);
      next[requestId] = {
        id: requestId,
        notebookId,
        kind: input.kind,
        brief: input.brief,
        sourceIds: input.sourceIds,
        status: "streaming",
        onComplete,
      };
      return { generations: next };
    });

    (async () => {
      try {
        for await (const event of stream) {
          if (!get().generations[requestId]) {
            try {
              await cancelGeneration(notebookId, requestId);
            } catch {
              // ignore
            }
            break;
          }

          if (event.type === "partial") {
            set((state) => {
              if (!state.generations[requestId]) return state;
              return {
                generations: {
                  ...state.generations,
                  [requestId]: {
                    ...state.generations[requestId],
                    status: "streaming",
                    progress: event.content,
                  },
                },
              };
            });
          } else if (event.type === "done") {
            await queryClient.invalidateQueries({
              queryKey: ["study-materials", notebookId],
            });

            let viewMaterialId = event.materialId;

            if (!viewMaterialId) {
              const list =
                queryClient.getQueryData<StudyMaterialDTO[]>(["study-materials", notebookId]) || [];
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
            toast.success(`${label} generated successfully!`, {
              action:
                viewMaterialId && onComplete
                  ? {
                      label: "View",
                      onClick: () => onComplete(viewMaterialId),
                    }
                  : undefined,
              duration: 8000,
            });
          } else if (event.type === "error") {
            throw event.error;
          }
        }
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : String(err);
        // Generation failures arrive as `{error, code[, model]}` envelopes
        // (or raw provider text) — classify to friendly copy so toasts never
        // show JSON or provider jargon.
        const message = classifyChatError(rawMessage).message;

        set((state) => {
          return { generations: updateGenerationError(state.generations, requestId, message) };
        });

        toast.error(`Failed to generate ${kindLabel(input.kind)}: ${message}`);
      }
    })();
  },

  cancelBackgroundGeneration: async (notebookId, id) => {
    const isTemp = id.startsWith("temp-");

    set((state) => {
      return { generations: removeGeneration(state.generations, id) };
    });

    if (!isTemp) {
      try {
        await cancelGeneration(notebookId, id);
        toast.info("Generation cancelled");
      } catch {
        // ignore
      }
    }
  },
}));

function kindLabel(kind: StudyMaterialKind): string {
  return KIND_LABELS[kind];
}
