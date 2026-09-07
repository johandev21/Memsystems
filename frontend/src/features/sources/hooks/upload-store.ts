import { create } from "zustand";
import type {
  SourceKind,
  SourceModality,
  SourceProcessingStage,
  SourceProcessingStatus,
} from "../types";

export interface PendingSourceUpload {
  id: string;
  notebookId: string;
  kind: SourceKind;
  modality?: SourceModality | null;
  title: string;
  url?: string;
  sourceId?: string;
  processingStage?: SourceProcessingStage | null;
  status: "uploading" | SourceProcessingStatus;
  errorMessage?: string;
  abortController?: AbortController;
}

interface UploadStoreState {
  pendingUploads: PendingSourceUpload[];
  addPendingUpload: (upload: Omit<PendingSourceUpload, "id" | "status">) => string;
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
      status: "uploading",
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
    set((state) => ({
      pendingUploads: state.pendingUploads.filter((item) => item.id !== id),
    }));
  },

  cancelPendingUpload: (id) => {
    const item = get().pendingUploads.find((u) => u.id === id);
    if (item?.abortController) {
      item.abortController.abort();
    }
    set((state) => ({
      pendingUploads: state.pendingUploads.filter((item) => item.id !== id),
    }));
  },
}));
