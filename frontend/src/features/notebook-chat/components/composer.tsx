import type { FileUIPart } from "ai";
import { type RefObject, useState } from "react";
import { useTranslation } from "react-i18next";
import {
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
} from "@/features/ai";
import type { ModelOption } from "@/features/ai";
import { useComposerModels } from "../hooks/use-composer-models";

export interface ComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (submission: { text: string; files?: FileUIPart[] } | string) => void;
  isLoading: boolean;
  onStop: () => void;
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  /**
   * True only when the Gateway catalog was verified. Non-capable rows stay
   * selectable; the picker only marks and filters them.
   */
  capabilitiesVerified: boolean;
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
  capabilitiesVerified,
  textareaRef,
}: ComposerProps) {
  const { t } = useTranslation("chat");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [search, setSearch] = useState("");

  const hasInput = input.trim().length > 0;

  const handleSubmit = (message: { text: string; files?: FileUIPart[] }) => {
    if (message.text.trim()) {
      onSubmit(message);
    }
  };

  const modelState = useComposerModels(models, selectedModel, search, {
    capabilitiesVerified,
  });

  return (
    <PromptInput
      data-slot="notebook-chat-composer"
      data-composer-state={isLoading ? "streaming" : hasInput ? "ready" : "empty"}
      onSubmit={handleSubmit}
      className="w-full [&_[data-slot=input-group]]:flex-col [&_[data-slot=input-group]]:items-stretch [&_[data-slot=input-group]]:border-composer-border [&_[data-slot=input-group]]:bg-composer-bg [&_[data-slot=input-group]]:p-2 [&_[data-slot=input-group]]:pb-1.5 [&_[data-slot=input-group]]:transition-chrome [&_[data-slot=input-group]]:duration-200 [&_[data-slot=input-group]]:focus-within:border-ring/60 [&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-ring/15"
    >
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
                <PromptInputButton className="group/model-trigger flex h-8 max-w-[min(18rem,calc(100vw-7rem))] cursor-pointer items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-muted-foreground transition-tint duration-150 hover:bg-muted/60 hover:text-foreground aria-expanded:bg-muted/70 aria-expanded:text-foreground [@media(pointer:coarse)]:h-9">
                  <ModelSelectorLogo
                    provider={modelState.activeProvider}
                    className="size-4 opacity-80"
                  />
                  <ModelSelectorName className="min-w-0">
                    {modelState.activeModel?.displayName || selectedModel}
                  </ModelSelectorName>
                </PromptInputButton>
              }
            />
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
                onSelect={(model) => {
                  onModelChange(model);
                  setModelSelectorOpen(false);
                }}
              />
            </ModelSelectorContent>
          </ModelSelector>
        </PromptInputTools>
        <PromptInputSubmit
          status={isLoading ? "streaming" : "ready"}
          onStop={onStop}
          disabled={!hasInput && !isLoading}
          tooltip={{
            content: isLoading ? t("composer.stopResponse") : t("composer.sendMessage"),
            shortcut: isLoading ? undefined : "Enter",
          }}
          className="size-8 rounded-xl shadow-none transition-interactive duration-150 enabled:shadow-sm [@media(pointer:coarse)]:size-9"
        />
      </PromptInputFooter>
    </PromptInput>
  );
}

