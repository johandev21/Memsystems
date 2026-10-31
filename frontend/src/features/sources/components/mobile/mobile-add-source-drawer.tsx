import { ArrowLeft, ChevronRight, FileUp, Globe, Type } from "lucide-react";
import { useRef, type ChangeEvent, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";
import {
  ACCEPTED_SOURCE_EXTENSIONS,
  ACCEPTED_SOURCE_MIME_TYPES,
  isClientSupportedSourceFile,
} from "../../utils/source-upload-actions";
import { TextInputMode } from "../text-input-mode";
import { UrlInputMode } from "../url-input-mode";
import { WebSearchComposer } from "../web-search-composer";

export interface MobileAddSourceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactElement;
  notebookId: string;
  mode: string;
  setMode: (mode: "menu" | "url" | "text") => void;
  onUploadFile: (file: File) => void;
  urlValue: string;
  onUrlValueChange: (v: string) => void;
  urlTitle: string;
  onUrlTitleChange: (v: string) => void;
  captionText: string;
  onCaptionTextChange: (v: string) => void;
  oauthToken: string;
  onOauthTokenChange: (v: string) => void;
  onSubmitUrl: () => void;
  textTitle: string;
  onTextTitleChange: (v: string) => void;
  textBody: string;
  onTextBodyChange: (v: string) => void;
  onSubmitText: () => void;
}

export function MobileAddSourceDrawer(props: MobileAddSourceDrawerProps) {
  const { open, onOpenChange, children, mode } = props;
  const { t } = useTranslation(["sources", "tree"]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isClientSupportedSourceFile(file)) {
        toast.error(t("sources:fileUploadMode.unsupportedFileType"));
        e.target.value = "";
        return;
      }
      props.onUploadFile(file);
    }
    e.target.value = "";
  };

  const isBusy = false;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {children && <DrawerTrigger render={children} />}
      <DrawerContent className="max-h-[92dvh] overflow-y-auto overscroll-contain p-4 pb-safe-lg">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_SOURCE_EXTENSIONS.join(",") + "," + ACCEPTED_SOURCE_MIME_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />

        {mode !== "menu" ? (
          <MobileAddSourceSubModeView
            mode={mode}
            setMode={props.setMode}
            urlValue={props.urlValue}
            onUrlValueChange={props.onUrlValueChange}
            urlTitle={props.urlTitle}
            onUrlTitleChange={props.onUrlTitleChange}
            captionText={props.captionText}
            onCaptionTextChange={props.onCaptionTextChange}
            oauthToken={props.oauthToken}
            onOauthTokenChange={props.onOauthTokenChange}
            onSubmitUrl={props.onSubmitUrl}
            textTitle={props.textTitle}
            onTextTitleChange={props.onTextTitleChange}
            textBody={props.textBody}
            onTextBodyChange={props.onTextBodyChange}
            onSubmitText={props.onSubmitText}
            isBusy={isBusy}
          />
        ) : (
          <MobileAddSourceMenu
            notebookId={props.notebookId}
            isBusy={isBusy}
            onTriggerFileInput={() => fileInputRef.current?.click()}
            onSelectMode={props.setMode}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

interface MobileAddSourceSubModeViewProps {
  mode: string;
  setMode: (mode: "menu" | "url" | "text") => void;
  urlValue: string;
  onUrlValueChange: (v: string) => void;
  urlTitle: string;
  onUrlTitleChange: (v: string) => void;
  captionText: string;
  onCaptionTextChange: (v: string) => void;
  oauthToken: string;
  onOauthTokenChange: (v: string) => void;
  onSubmitUrl: () => void;
  textTitle: string;
  onTextTitleChange: (v: string) => void;
  textBody: string;
  onTextBodyChange: (v: string) => void;
  onSubmitText: () => void;
  isBusy: boolean;
}

function MobileAddSourceSubModeView({
  mode,
  setMode,
  urlValue,
  onUrlValueChange,
  urlTitle,
  onUrlTitleChange,
  captionText,
  onCaptionTextChange,
  oauthToken,
  onOauthTokenChange,
  onSubmitUrl,
  textTitle,
  onTextTitleChange,
  textBody,
  onTextBodyChange,
  onSubmitText,
  isBusy,
}: MobileAddSourceSubModeViewProps) {
  const { t } = useTranslation("sources");
  return (
    <>
      <DrawerHeader className="pb-3 text-left">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-slot="mobile-add-source-back"
            onClick={() => setMode("menu")}
            aria-label={t("urlMode.back", "Back")}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-97 transition-transform touch-manipulation cursor-pointer"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-base font-semibold truncate">
              {mode === "url"
                ? t("addSourceDialog.urlTitle")
                : t("addSourceDialog.textTitle")}
            </DrawerTitle>
            <DrawerDescription className="text-xs truncate">
              {mode === "url"
                ? t("addSourceDialog.urlDescription")
                : t("addSourceDialog.textDescription")}
            </DrawerDescription>
          </div>
        </div>
      </DrawerHeader>

      <div className="pt-2">
        {mode === "url" && (
          <UrlInputMode
            urlValue={urlValue}
            onUrlValueChange={onUrlValueChange}
            urlTitle={urlTitle}
            onUrlTitleChange={onUrlTitleChange}
            captionText={captionText}
            onCaptionTextChange={onCaptionTextChange}
            oauthToken={oauthToken}
            onOauthTokenChange={onOauthTokenChange}
            onSubmit={onSubmitUrl}
            onBack={() => setMode("menu")}
            isPending={false}
            busy={isBusy}
          />
        )}

        {mode === "text" && (
          <TextInputMode
            textTitle={textTitle}
            onTextTitleChange={onTextTitleChange}
            textBody={textBody}
            onTextBodyChange={onTextBodyChange}
            onSubmit={onSubmitText}
            onBack={() => setMode("menu")}
            isPending={false}
            busy={isBusy}
          />
        )}
      </div>
    </>
  );
}

interface MobileAddSourceMenuProps {
  notebookId: string;
  isBusy: boolean;
  onTriggerFileInput: () => void;
  onSelectMode: (mode: "url" | "text") => void;
}

function MobileAddSourceMenu({
  notebookId,
  isBusy,
  onTriggerFileInput,
  onSelectMode,
}: MobileAddSourceMenuProps) {
  const { t } = useTranslation(["sources", "tree"]);
  return (
    <>
      <DrawerHeader className="pb-2 text-left">
        <DrawerTitle className="text-base font-semibold text-foreground">
          {t("sources:mobile.addSource", "Add sources")}
        </DrawerTitle>
        <DrawerDescription className="text-xs text-muted-foreground">
          {t("sources:addSourceDialog.description", "Search the web or bring in your own material.")}
        </DrawerDescription>
      </DrawerHeader>

      <div className="flex flex-col gap-4 py-1">
        <WebSearchComposer
          notebookId={notebookId}
          showHeader={false}
        />

        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            data-slot="mobile-add-source-option-file"
            onClick={onTriggerFileInput}
            disabled={isBusy}
            className="flex min-h-12 w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none [@media(hover:hover)]:hover:bg-muted disabled:opacity-50"
          >
            <FileUp className="size-5 shrink-0 text-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">
                {t("sources:fileUploadMode.uploadFiles", "Upload files")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("sources:mobile.uploadFilesHint", "PDF, documents, images, audio, or video")}
              </span>
            </div>
          </button>

          <button
            type="button"
            data-slot="mobile-add-source-option-url"
            onClick={() => onSelectMode("url")}
            disabled={isBusy}
            className="flex min-h-12 w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none [@media(hover:hover)]:hover:bg-muted disabled:opacity-50"
          >
            <Globe className="size-5 shrink-0 text-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">
                {t("sources:addSourceDialog.urlTitle", "Add web link")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("sources:addSourceDialog.urlDescription", "Website, YouTube, arXiv, or DOI")}
              </span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </button>

          <button
            type="button"
            data-slot="mobile-add-source-option-text"
            onClick={() => onSelectMode("text")}
            disabled={isBusy}
            className="flex min-h-12 w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-muted active:scale-98 touch-manipulation cursor-pointer select-none [@media(hover:hover)]:hover:bg-muted disabled:opacity-50"
          >
            <Type className="size-5 shrink-0 text-foreground" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-foreground">
                {t("sources:addSourceDialog.textTitle", "Paste text")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("sources:addSourceDialog.textDescription", "Notes or copied text")}
              </span>
            </div>
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          </button>
        </div>

      </div>
    </>
  );
}
