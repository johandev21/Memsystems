import type { useQueryClient } from "@tanstack/react-query";
import { updateNotebook, uploadNotebookBanner, deleteNotebookBanner } from "../../api/notebooks";
import type { BannerUploadPayload } from "../../utils/banner-variants";

export const DEFAULT_FOCAL_POINT = { x: 0.5, y: 0.5 };

export interface BannerDraftState {
  title: string;
  description: string;
  icon: string;
  focalPoint: { x: number; y: number };
  previewUrl: string | null;
  bannerRemoved: boolean;
  imageError: boolean;
}

export type BannerDraftAction =
  | { type: "RESET"; payload: BannerDraftState }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "SET_ICON"; icon: string }
  | { type: "SET_FOCAL_POINT"; focalPoint: { x: number; y: number } }
  | { type: "SET_PREVIEW"; previewUrl: string }
  | { type: "REMOVE_BANNER" }
  | { type: "SET_IMAGE_ERROR"; error: boolean };

export function bannerDraftReducer(
  state: BannerDraftState,
  action: BannerDraftAction,
): BannerDraftState {
  switch (action.type) {
    case "RESET":
      return action.payload;
    case "SET_TITLE":
      return { ...state, title: action.title };
    case "SET_DESCRIPTION":
      return { ...state, description: action.description };
    case "SET_ICON":
      return { ...state, icon: action.icon };
    case "SET_FOCAL_POINT":
      return { ...state, focalPoint: action.focalPoint };
    case "SET_PREVIEW":
      return {
        ...state,
        previewUrl: action.previewUrl,
        bannerRemoved: false,
        focalPoint: DEFAULT_FOCAL_POINT,
        imageError: false,
      };
    case "REMOVE_BANNER":
      return { ...state, previewUrl: null, bannerRemoved: true };
    case "SET_IMAGE_ERROR":
      return { ...state, imageError: action.error };
    default:
      return state;
  }
}

export async function saveNotebookBannerChanges({
  notebookId,
  title,
  description,
  icon,
  bannerUrl,
  bannerFocalPoint,
  draft,
  bannerUpload,
  queryClient,
}: {
  notebookId: string;
  title: string;
  description?: string | null;
  icon?: string;
  bannerUrl?: string | null;
  bannerFocalPoint?: { x: number; y: number } | null;
  draft: BannerDraftState;
  bannerUpload: BannerUploadPayload | null;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const requests: Promise<unknown>[] = [];
  const fieldsChanged =
    draft.title !== title ||
    draft.description !== (description ?? "") ||
    draft.icon !== (icon ?? "notebook") ||
    draft.focalPoint.x !== (bannerFocalPoint?.x ?? 0.5) ||
    draft.focalPoint.y !== (bannerFocalPoint?.y ?? 0.5);

  if (fieldsChanged && !bannerUpload) {
    requests.push(
      updateNotebook(notebookId, {
        title: draft.title,
        description: draft.description,
        icon: draft.icon,
        bannerFocalPoint: draft.focalPoint,
      }),
    );
  } else if (fieldsChanged) {
    requests.push(
      updateNotebook(notebookId, {
        title: draft.title,
        description: draft.description,
        icon: draft.icon,
      }),
    );
  }

  if (bannerUpload) {
    requests.push(
      uploadNotebookBanner(notebookId, bannerUpload.file, draft.focalPoint, bannerUpload.variants),
    );
  } else if (draft.bannerRemoved && bannerUrl) {
    requests.push(deleteNotebookBanner(notebookId));
  }

  await Promise.all(requests);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["notebooks", notebookId] }),
    queryClient.invalidateQueries({ queryKey: ["notebooks"] }),
  ]);
}
