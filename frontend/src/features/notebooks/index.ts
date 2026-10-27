// API
export {
  createNotebook,
  deleteNotebook,
  deleteNotebookBanner,
  exportNotebook,
  importNotebook,
  notebookQueryOptions,
  notebooksQueryOptions,
  updateNotebook,
  uploadNotebookBanner,
} from "./api/notebooks";
export type { NotebooksPage } from "./api/notebooks";

// Types
export type {
  BannerCrop,
  CreateNotebookDto,
  Notebook,
  NotebookBannerVariants,
  NotebooksResponse,
  UpdateNotebookDto,
} from "./types/notebook.types";

// Model
export {
  DEFAULT_GROUNDING_MODE,
  GROUNDING_MODES,
  canSubmitBrief,
  resolveGroundingMode,
  useNotebookGroundingMode,
} from "./model/grounding-mode";
export type { GroundingMode } from "./model/grounding-mode";

// Context
export { NotebookModelProvider } from "./context/notebook-model-context";
export {
  NotebookModelContext,
  useNotebookModel,
} from "./context/notebook-model-state";
export type { NotebookModelContextValue } from "./context/notebook-model-state";

// Hooks
export { useBannerFocalPointDrag } from "./hooks/use-banner-focal-point-drag";
export { useDescriptionOverflow } from "./hooks/use-description-overflow";
export { useModelPersistence } from "./hooks/use-model-persistence";
export { useNotebookBannerEditor } from "./hooks/use-notebook-banner-editor";
export { useNotebookPanels } from "./hooks/use-notebook-panels";
export {
  CLEAR_NOTEBOOK_CHAT_EVENT,
  EDIT_NOTEBOOK_EVENT,
  useNotebookSettingsActions,
} from "./hooks/use-notebook-settings-actions";
export { useSourcesPanel } from "./hooks/use-sources-panel";
export { useStudioDialogs } from "./hooks/use-studio-dialogs";
export {
  useNotebookTitleEditor,
  useUpdateNotebookTitle,
} from "./hooks/use-update-notebook-title";

// Components
export { EditableNotebookTitle } from "./components/editable-notebook-title";
export { MobileNotebookMenuDrawer } from "./components/mobile-notebook-menu-drawer";
export { NotebookHeader } from "./components/notebook-header";
export { NotebookIcon } from "./components/notebook-icon";
export { DynamicIcon } from "./components/icon-picker/dynamic-icon";
export type { DynamicIconProps } from "./components/icon-picker/dynamic-icon";
export { IconPicker } from "./components/icon-picker/icon-picker";
export type { IconPickerProps } from "./components/icon-picker/icon-picker";

// Components - Dialogs
export { ImageUploadDialog } from "./components/dialogs/image-upload-dialog";
export { NotebookSettingsDialog } from "./components/dialogs/notebook-settings-dialog";

// Components - Workspace
export { DesktopLayout } from "./components/notebook-workspace/desktop-layout";
export { MobileNotebookLayout } from "./components/notebook-workspace/mobile-notebook-layout";
export { MobileTabsHeader } from "./components/notebook-workspace/mobile-tabs-header";
export { NotebookWorkspaceContainer } from "./components/notebook-workspace/notebook-workspace-container";
export { StudioPanelHeader } from "./components/notebook-workspace/studio-panel-header";

// Components - Shared
export { BannerCanvas } from "./components/shared/banner-canvas";
export { NotebookBanner } from "./components/shared/notebook-banner";
export { NotebookDescription } from "./components/shared/notebook-description";
export { StudioResources } from "./components/shared/studio-resources";
export {
  KIND_LABEL_KEYS,
  RESOURCES,
  isInScope,
} from "./components/shared/studio-resources-config";
export type { ResourceConfig } from "./components/shared/studio-resources-config";

// Components - Studio
export { RightPane } from "./components/studio/right-pane";
