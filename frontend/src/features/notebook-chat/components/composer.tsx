import type { FileUIPart } from "ai";
import { CheckIcon, ChevronDownIcon, ImageIcon, XIcon } from "lucide-react";
import { type RefObject, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/features/ai";
import type { ModelOption } from "@/features/ai";
import { getProviderName, useComposerModels } from "../hooks/use-composer-models";

export interface ComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (submission: { text: string; files?: FileUIPart[] } | string) => void;
  isLoading: boolean;
  onStop: () => void;
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
  models,
  selectedModel,
  onModelChange,
  textareaRef,
}: ComposerProps) {
  const { t } = useTranslation("chat");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [search, setSearch] = useState("");

  const hasInput = input.trim().length > 0;

  const handleSubmit = (message: { text: string; files: FileUIPart[] }) => {
    if (message.text.trim() || message.files.length > 0) {
      onSubmit(message);
    }
  };

  const modelState = useComposerModels(models, selectedModel, search);

  return (
    <PromptInput
      data-slot="notebook-chat-composer"
      data-composer-state={isLoading ? "streaming" : hasInput ? "ready" : "empty"}
      accept="image/jpeg,image/png,image/webp,image/gif"
      maxFileSize={10 * 1024 * 1024}
      onSubmit={handleSubmit}
      className="w-full [&_[data-slot=input-group]]:flex-col [&_[data-slot=input-group]]:items-stretch [&_[data-slot=input-group]]:border-composer-border [&_[data-slot=input-group]]:bg-composer-bg [&_[data-slot=input-group]]:p-2 [&_[data-slot=input-group]]:pb-1.5 [&_[data-slot=input-group]]:shadow-[var(--composer-glow),inset_0_1px_0_var(--composer-highlight),0_16px_44px_-28px_var(--composer-shadow)] [&_[data-slot=input-group]]:transition-[background-color,border-color,box-shadow] [&_[data-slot=input-group]]:duration-200 [&_[data-slot=input-group]]:focus-within:border-ring/60 [&_[data-slot=input-group]]:focus-within:shadow-[var(--composer-glow),inset_0_1px_0_var(--composer-highlight),0_18px_48px_-26px_var(--composer-shadow)] [&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-ring/15"
    >
      <ComposerAttachmentList />
      <PromptInputBody>
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.currentTarget.value)}
          placeholder={t("composer.placeholder")}
          className="min-h-12 max-h-48 select-text border-0 px-3 py-2 text-base leading-6 focus:ring-0 focus-visible:ring-0 sm:text-sm"
        />
      </PromptInputBody>
      <PromptInputFooter className="px-1.5 pt-0.5 pb-0.5">
        <PromptInputTools>
          <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
            <ModelSelectorTrigger
              render={
                <PromptInputButton className="group/model-trigger flex h-8 max-w-[min(18rem,calc(100vw-7rem))] cursor-pointer items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-muted/60 hover:text-foreground aria-expanded:bg-muted/70 aria-expanded:text-foreground [@media(pointer:coarse)]:h-9">
                  <ModelSelectorLogo
                    provider={modelState.activeProvider}
                    className="size-4 opacity-80"
                  />
                  <ModelSelectorName className="min-w-0">
                    {modelState.activeModel?.displayName || selectedModel}
                  </ModelSelectorName>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0 opacity-55 transition-transform duration-150 group-aria-expanded/model-trigger:rotate-180"
                  />
                </PromptInputButton>
              }
            />
            <ModelSelectorContent title={t("composer.selectModelTitle")}>
              <ModelSelectorInput
                placeholder={t("composer.searchPlaceholder")}
                value={search}
                onValueChange={setSearch}
              />
              <ComposerModelList
                groups={modelState.groups}
                selectedModel={selectedModel}
                onSelect={(model) => {
                  onModelChange(model);
                  setModelSelectorOpen(false);
                }}
              />
            </ModelSelectorContent>
          </ModelSelector>
          {modelState.supportsImages && (
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                className="size-8 rounded-xl"
                tooltip={t("composer.attachPhoto")}
                aria-label={t("composer.attachPhoto")}
              />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label={t("composer.attachPhoto")} />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          )}
        </PromptInputTools>
        <PromptInputSubmit
          status={isLoading ? "streaming" : "ready"}
          onStop={onStop}
          disabled={!hasInput && !isLoading}
          tooltip={{
            content: isLoading ? t("composer.stopResponse") : t("composer.sendMessage"),
            shortcut: isLoading ? undefined : "Enter",
          }}
          className="size-8 rounded-xl shadow-none transition-[background-color,color,box-shadow] duration-150 enabled:shadow-sm [@media(pointer:coarse)]:size-9"
        />
      </PromptInputFooter>
    </PromptInput>
  );
}

function ComposerAttachmentList() {
  const { t } = useTranslation("chat");
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
      {attachments.files.map((file) => (
        <div
          key={file.id}
          className="group relative flex items-center gap-2 rounded-lg border border-surface-border bg-surface-2 p-1.5 text-xs text-foreground shadow-xs"
        >
          {file.mediaType?.startsWith("image/") ? (
            <img
              src={file.url}
              alt={file.filename || t("composer.attachmentAlt")}
              className="size-7 rounded object-cover"
            />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
          <span className="max-w-30 truncate text-xs">
            {file.filename || t("composer.imageAlt")}
          </span>
          <button
            type="button"
            onClick={() => attachments.remove(file.id)}
            className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground cursor-pointer"
            aria-label={t("composer.removeAttachment")}
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ComposerModelList({
  groups,
  selectedModel,
  onSelect,
}: {
  groups: Record<string, ModelOption[]>;
  selectedModel: string;
  onSelect: (model: string) => void;
}) {
  const { t } = useTranslation("chat");

  return (
    <ModelSelectorList>
      <ModelSelectorEmpty>{t("composer.noModelsFound")}</ModelSelectorEmpty>
      {Object.entries(groups).map(([provider, models]) => (
        <ModelGroup
          key={provider}
          provider={provider}
          models={models}
          selectedModel={selectedModel}
          onSelect={onSelect}
        />
      ))}
    </ModelSelectorList>
  );
}

function ModelGroup({
  provider,
  models,
  selectedModel,
  onSelect,
}: {
  provider: string;
  models: ModelOption[];
  selectedModel: string;
  onSelect: (model: string) => void;
}) {
  return (
    <ModelSelectorGroup heading={getProviderName(provider)}>
      {models.map((model) => (
        <ModelOption
          key={model.id}
          model={model}
          provider={provider}
          selected={selectedModel === model.id}
          onSelect={onSelect}
        />
      ))}
    </ModelSelectorGroup>
  );
}

function ModelOption({
  model,
  provider,
  selected,
  onSelect,
}: {
  model: ModelOption;
  provider: string;
  selected: boolean;
  onSelect: (model: string) => void;
}) {
  return (
    <ModelSelectorItem
      value={model.id}
      onSelect={() => onSelect(model.id)}
      className="flex items-center gap-2 cursor-pointer"
    >
      <ModelSelectorLogo provider={provider} />
      <ModelSelectorName>{model.displayName}</ModelSelectorName>
      {selected ? <CheckIcon className="ml-auto size-4" /> : <div className="ml-auto size-4" />}
    </ModelSelectorItem>
  );
}
