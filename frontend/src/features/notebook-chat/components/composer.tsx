import type { FileUIPart } from "ai";
import { CheckIcon, ChevronDownIcon, ImageIcon, XIcon } from "lucide-react";
import { type RefObject, useMemo, useState } from "react";
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

const providerNames: Record<string, string> = {
  openai: "OpenAI",
  opencode: "OpenCode",
  google: "Google",
  gemini: "Gemini",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  kimi: "Kimi",
};

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
          placeholder="Type a message..."
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
            <ModelSelectorContent title="Select Model">
              <ModelSelectorInput
                placeholder="Search models..."
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
                tooltip="Attach photo"
                aria-label="Attach photo"
              />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="Attach photo" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          )}
        </PromptInputTools>
        <PromptInputSubmit
          status={isLoading ? "streaming" : "ready"}
          onStop={onStop}
          disabled={!hasInput && !isLoading}
          tooltip={{
            content: isLoading ? "Stop response" : "Send message",
            shortcut: isLoading ? undefined : "Enter",
          }}
          className="size-8 rounded-xl shadow-none transition-[background-color,color,box-shadow] duration-150 enabled:shadow-sm [@media(pointer:coarse)]:size-9"
        />
      </PromptInputFooter>
    </PromptInput>
  );
}

function ComposerAttachmentList() {
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
              alt={file.filename || "Attachment"}
              className="size-7 rounded object-cover"
            />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground" />
          )}
          <span className="max-w-[120px] truncate text-xs">{file.filename || "Image"}</span>
          <button
            type="button"
            onClick={() => attachments.remove(file.id)}
            className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground cursor-pointer"
            aria-label="Remove attachment"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function normalizeModels(models: ModelOption[] | unknown): ModelOption[] {
  if (Array.isArray(models)) return models;
  if (models && typeof models === "object" && "models" in models && Array.isArray(models.models))
    return models.models as ModelOption[];
  return [];
}

function filterModels(models: ModelOption[], search: string) {
  const query = search.trim().toLowerCase();
  return query
    ? models.filter(
        (model) =>
          model.displayName.toLowerCase().includes(query) || model.id.toLowerCase().includes(query),
      )
    : models;
}

function groupModels(models: ModelOption[]) {
  return models.reduce<Record<string, ModelOption[]>>((groups, model) => {
    const provider = model.id.split("/")[0] || "openai";
    (groups[provider] ??= []).push(model);
    return groups;
  }, {});
}

function getProviderName(provider: string) {
  return providerNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

function useComposerModels(models: ModelOption[] | unknown, selectedModel: string, search: string) {
  const safeModels = useMemo(() => normalizeModels(models), [models]);
  const groups = useMemo(() => groupModels(filterModels(safeModels, search)), [safeModels, search]);
  const activeModel = safeModels.find((model) => model.id === selectedModel);
  const supportsImages = activeModel?.capabilities?.imageInput === true;
  return {
    activeModel,
    activeProvider: selectedModel.split("/")[0] || "openai",
    groups,
    supportsImages,
  };
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
  return (
    <ModelSelectorList>
      <ModelSelectorEmpty>No models found</ModelSelectorEmpty>
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
      {model.isFreeTier && (
        <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-semibold text-success">
          Free
        </span>
      )}
      {(model.supportsWebSearch === true || model.capabilities?.webSearch === true) && (
        <span
          className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary"
          title="Supports web search"
        >
          Web
        </span>
      )}
      {selected ? <CheckIcon className="ml-auto size-4" /> : <div className="ml-auto size-4" />}
    </ModelSelectorItem>
  );
}
