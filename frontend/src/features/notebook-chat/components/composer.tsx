import type { FileUIPart } from "ai";
import { Paperclip, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  MobileModelSelectorDrawer,
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorLogo,
  ModelSelectorModels,
  ModelSelectorName,
  ModelSelectorTrigger,
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/features/ai";
import type { ModelOption } from "@/features/ai";
import { useComposerModels } from "../hooks/use-composer-models";
import { useMediaQuery } from "../hooks/use-media-query";

export interface ComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (submission: { text: string; files?: FileUIPart[] } | string) => void;
  isLoading: boolean;
  isDisabled?: boolean;
  onStop: () => void;
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  capabilitiesVerified: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

interface ComposerInnerProps {
  input: string;
  onInputChange: (value: string) => void;
  isLoading: boolean;
  isDisabled: boolean;
  onStop: () => void;
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  capabilitiesVerified: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

type UnsupportedAttachmentKey = "composer.unsupportedImage" | "composer.unsupportedAttachment";

function findUnsupportedAttachment(
  files: FileUIPart[],
  activeModel: ModelOption | undefined,
): UnsupportedAttachmentKey | null {
  if (!activeModel) return null;

  for (const file of files) {
    const isImage = file.mediaType?.startsWith("image/");
    if (isImage && activeModel.capabilities?.imageInput !== true) {
      return "composer.unsupportedImage";
    }
    if (!isImage && activeModel.capabilities?.fileInput !== true) {
      return "composer.unsupportedAttachment";
    }
  }

  return null;
}

function ComposerModelPicker({
  models,
  selectedModel,
  onModelChange,
  capabilitiesVerified,
}: Pick<ComposerInnerProps, "models" | "selectedModel" | "onModelChange" | "capabilitiesVerified">) {
  const { t } = useTranslation("chat");
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const modelState = useComposerModels(models, selectedModel, search, { capabilitiesVerified });
  const modelTriggerButton = (
    <PromptInputButton className="group/model-trigger flex h-8 max-w-[min(18rem,calc(100vw-6rem))] cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground motion-tint duration-150 hover:bg-muted/60 hover:text-foreground aria-expanded:bg-muted/70 aria-expanded:text-foreground touch-manipulation active:scale-97 sm:rounded-xl">
      <ModelSelectorLogo
        provider={modelState.activeProvider}
        className="size-3.5 opacity-80 sm:size-4"
      />
      <ModelSelectorName className="min-w-0">
        {modelState.activeModel?.displayName || selectedModel}
      </ModelSelectorName>
    </PromptInputButton>
  );

  const handleSelect = (model: string) => {
    onModelChange(model);
    setModelSelectorOpen(false);
  };

  if (isDesktop) {
    return (
      <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
        <ModelSelectorTrigger render={modelTriggerButton} />
        <ModelSelectorContent title={t("composer.selectModelTitle")}>
          <ModelSelectorInput
            placeholder={t("composer.searchPlaceholder")}
            value={search}
            onValueChange={setSearch}
          />
          <ModelSelectorModels
            groups={modelState.groups}
            selectedModel={selectedModel}
            capabilitiesVerified={capabilitiesVerified}
            emptyLabel={t("composer.noModelsFound")}
            onSelect={handleSelect}
          />
        </ModelSelectorContent>
      </ModelSelector>
    );
  }

  return (
    <MobileModelSelectorDrawer
      open={modelSelectorOpen}
      onOpenChange={setModelSelectorOpen}
      trigger={modelTriggerButton}
      groups={modelState.groups}
      selectedModel={selectedModel}
      onSelect={handleSelect}
      search={search}
      onSearchChange={setSearch}
      title={t("composer.selectModelTitle")}
      searchPlaceholder={t("composer.searchPlaceholder")}
      emptyLabel={t("composer.noModelsFound")}
    />
  );
}

function ComposerInner({
  input,
  onInputChange,
  isLoading,
  isDisabled,
  onStop,
  models,
  selectedModel,
  onModelChange,
  capabilitiesVerified,
  textareaRef,
}: ComposerInnerProps) {
  const { t } = useTranslation("chat");
  const attachments = usePromptInputAttachments();

  const hasFiles = attachments.files.length > 0;
  const hasInput = input.trim().length > 0;

  const activeModel = models.find((model) => model.id === selectedModel);
  const unsupportedKey = findUnsupportedAttachment(attachments.files, activeModel);
  const unsupportedError = unsupportedKey ? t(unsupportedKey) : null;

  const prevCheckedKeyRef = useRef<string>("");

  useEffect(() => {
    if (!unsupportedError) {
      prevCheckedKeyRef.current = "";
      return;
    }
    const currentKey = `${selectedModel}:${attachments.files.map((f) => f.id || f.filename).join(",")}:${unsupportedError}`;
    if (prevCheckedKeyRef.current === currentKey) return;
    prevCheckedKeyRef.current = currentKey;
    toast.error(unsupportedError);
  }, [unsupportedError, selectedModel, attachments.files]);

  return (
    <>
      <PromptInputBody>
        {attachments.files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-1.5">
            {attachments.files.map((file) => (
              <div
                key={file.id}
                className="group relative flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs text-foreground max-w-xs"
              >
                {file.mediaType?.startsWith("image/") ? (
                  <img
                    src={file.url}
                    alt={file.filename || t("composer.imageAlt")}
                    className="size-5 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate max-w-[120px]">{file.filename || t("composer.attachmentAlt")}</span>
                <button
                  type="button"
                  onClick={() => attachments.remove(file.id)}
                  className="size-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  aria-label={t("composer.removeAttachment")}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {unsupportedError && (
          <div
            role="alert"
            className="text-destructive text-xs px-2.5 pt-1"
          >
            {unsupportedError}
          </div>
        )}
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.currentTarget.value)}
          placeholder={t("composer.placeholder")}
          className="min-h-9 max-h-48 select-text border-0 px-2.5 py-1.5 text-sm leading-5 placeholder:text-sm focus:ring-0 focus-visible:ring-0 sm:min-h-12 sm:px-3 sm:py-2 sm:leading-6"
        />
      </PromptInputBody>
      <PromptInputFooter className="px-1.5 pt-0 pb-0.5 sm:pt-0.5">
        <PromptInputTools>
          <PromptInputButton
            type="button"
            onClick={attachments.openFileDialog}
            aria-label={t("composer.attachFiles")}
            tooltip={t("composer.attachFiles")}
            className="flex min-h-11 min-w-11 sm:min-h-8 sm:min-w-8 sm:size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground motion-tint duration-150 hover:bg-muted/60 hover:text-foreground touch-manipulation active:scale-97 sm:rounded-xl"
          >
            <Paperclip className="size-4" aria-hidden="true" />
          </PromptInputButton>
          <ComposerModelPicker
            models={models}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            capabilitiesVerified={capabilitiesVerified}
          />
        </PromptInputTools>
        <PromptInputSubmit
          status={isLoading ? "streaming" : "ready"}
          onStop={onStop}
          disabled={isDisabled || (!hasInput && !hasFiles && !isLoading)}
          tooltip={{
            content: isLoading ? t("composer.stopResponse") : t("composer.sendMessage"),
            shortcut: isLoading ? undefined : "Enter",
          }}
          className="size-8 rounded-lg shadow-none motion-interactive duration-150 enabled:shadow-sm touch-manipulation active:scale-97 cursor-pointer sm:rounded-xl"
        />
      </PromptInputFooter>
    </>
  );
}

export function Composer({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isDisabled = false,
  onStop,
  models,
  selectedModel,
  onModelChange,
  capabilitiesVerified,
  textareaRef,
}: ComposerProps) {
  const { t } = useTranslation("chat");
  const hasInput = input.trim().length > 0;

  const activeModel = models.find((m) => m.id === selectedModel);

  const handleSubmit = (message: { text: string; files?: FileUIPart[] }) => {
    const hasFiles = Boolean(message.files && message.files.length > 0);
    if (!message.text.trim() && !hasFiles) return;

    if (hasFiles && message.files) {
      for (const file of message.files) {
        const isImage = file.mediaType?.startsWith("image/");
        if (isImage && activeModel && activeModel.capabilities?.imageInput !== true) {
          toast.error(t("composer.unsupportedImage"));
          return;
        }
        if (!isImage && activeModel && activeModel.capabilities?.fileInput !== true) {
          toast.error(t("composer.unsupportedAttachment"));
          return;
        }
      }
    }

    onSubmit(message);
  };

  return (
    <PromptInput
      data-slot="notebook-chat-composer"
      data-composer-state={isLoading ? "streaming" : hasInput ? "ready" : "empty"}
      onSubmit={handleSubmit}
      className="w-full [&_[data-slot=input-group]]:flex-col [&_[data-slot=input-group]]:items-stretch [&_[data-slot=input-group]]:border-composer-border [&_[data-slot=input-group]]:bg-composer-bg [&_[data-slot=input-group]]:p-2 [&_[data-slot=input-group]]:pb-1.5 [&_[data-slot=input-group]]:motion-chrome [&_[data-slot=input-group]]:duration-200 [&_[data-slot=input-group]]:focus-within:border-ring/60 [&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-ring/15"
    >
      <ComposerInner
        input={input}
        onInputChange={onInputChange}
        isLoading={isLoading}
        isDisabled={isDisabled}
        onStop={onStop}
        models={models}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        capabilitiesVerified={capabilitiesVerified}
        textareaRef={textareaRef}
      />
    </PromptInput>
  );
}
