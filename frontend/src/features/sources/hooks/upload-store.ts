import { create } from "zustand";
import type { SourceKind } from "../types";

export interface PendingSourceUpload {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  url?: string;
  progress: number;
  statusText: string;
  status: "fetching" | "extracting" | "processing" | "completed" | "error";
  errorMessage?: string;
  abortController?: AbortController;
  timerId?: ReturnType<typeof setInterval>;
}

interface UploadStoreState {
  pendingUploads: PendingSourceUpload[];
  addPendingUpload: (
    upload: Omit<PendingSourceUpload, "id" | "progress" | "status" | "statusText"> & {
      initialProgress?: number;
      initialStatusText?: string;
    },
  ) => string;
  updatePendingUpload: (
    id: string,
    update:
      | Partial<PendingSourceUpload>
      | ((prev: PendingSourceUpload) => Partial<PendingSourceUpload>),
  ) => void;
  removePendingUpload: (id: string) => void;
  cancelPendingUpload: (id: string) => void;
}

export const useUploadStore = create<UploadStoreState>((set, get) => ({
  pendingUploads: [],

  addPendingUpload: (upload) => {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newItem: PendingSourceUpload = {
      ...upload,
      id,
      progress: upload.initialProgress ?? 10,
      status: "fetching",
      statusText: upload.initialStatusText ?? "Connecting to website...",
    };

    set((state) => ({
      pendingUploads: [newItem, ...state.pendingUploads],
    }));

    return id;
  },

  updatePendingUpload: (id, update) => {
    set((state) => ({
      pendingUploads: state.pendingUploads.map((item) => {
        if (item.id !== id) return item;
        const patch = typeof update === "function" ? update(item) : update;
        return { ...item, ...patch };
      }),
    }));
  },

  removePendingUpload: (id) => {
    const item = get().pendingUploads.find((u) => u.id === id);
    if (item?.timerId) {
      clearInterval(item.timerId);
    }
    set((state) => ({
      pendingUploads: state.pendingUploads.filter((item) => item.id !== id),
    }));
  },

  cancelPendingUpload: (id) => {
    const item = get().pendingUploads.find((u) => u.id === id);
    if (item?.abortController) {
      item.abortController.abort();
    }
    if (item?.timerId) {
      clearInterval(item.timerId);
    }
    set((state) => ({
      pendingUploads: state.pendingUploads.filter((item) => item.id !== id),
    }));
  },
}));
