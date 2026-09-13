import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useGatewayKeyForm } from "../hooks/use-gateway-key-form";

export function GatewayKeyForm({ hasKey }: { hasKey: boolean }) {
  const { t } = useTranslation("settings");
  const {
    input,
    setInput,
    showKey,
    setShowKey,
    isMasked,
    isDirty,
    isSaving,
    isRemoving,
    confirmRemove,
    saved,
    busy,
    handleSave,
    handleRemove,
    handleClearConfirmRemove,
  } = useGatewayKeyForm(hasKey);

  return (
    <form id="gateway-key-form" onSubmit={handleSave} className="flex flex-col gap-2">
      <label htmlFor="gateway-key-input" className="text-sm font-medium text-foreground">
        {t("gateway.apiKey.label")}
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <GatewayKeyInputControl
          input={input}
          showKey={showKey}
          isMasked={isMasked}
          busy={busy}
          placeholder={t("gateway.apiKey.placeholder")}
          replaceLabel={t("gateway.apiKey.replace")}
          hideLabel={t("gateway.apiKey.hide")}
          showLabel={t("gateway.apiKey.show")}
          onInputChange={(value) => {
            setInput(value);
            handleClearConfirmRemove();
          }}
          onReplace={() => {
            setInput("");
            setShowKey(false);
          }}
          onToggleShowKey={() => setShowKey((current) => !current)}
        />

        <GatewayKeyActionButtons
          hasKey={hasKey}
          isMasked={isMasked}
          isDirty={isDirty}
          busy={busy}
          isSaving={isSaving}
          saved={saved}
          isRemoving={isRemoving}
          confirmRemove={confirmRemove}
          saveLabel={t("gateway.apiKey.save")}
          savingLabel={t("gateway.apiKey.saving")}
          savedLabel={t("gateway.apiKey.saved")}
          removeLabel={t("gateway.apiKey.remove")}
          removingLabel={t("gateway.apiKey.removing")}
          confirmRemoveLabel={t("gateway.apiKey.confirmRemove")}
          onRemove={() => void handleRemove()}
        />
      </div>
      {confirmRemove && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("gateway.apiKey.removeConfirm")}
        </p>
      )}
    </form>
  );
}

function GatewayKeyInputControl({
  input,
  showKey,
  isMasked,
  busy,
  placeholder,
  replaceLabel,
  hideLabel,
  showLabel,
  onInputChange,
  onReplace,
  onToggleShowKey,
}: {
  input: string;
  showKey: boolean;
  isMasked: boolean;
  busy: boolean;
  placeholder: string;
  replaceLabel: string;
  hideLabel: string;
  showLabel: string;
  onInputChange: (value: string) => void;
  onReplace: () => void;
  onToggleShowKey: () => void;
}) {
  return (
    <div className="flex-1">
      <div className="relative flex h-10 items-center rounded-2xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        <input
          id="gateway-key-input"
          form="gateway-key-form"
          type={showKey ? "text" : "password"}
          placeholder={placeholder}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          readOnly={isMasked}
          disabled={busy}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
        />
        {isMasked && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onReplace}
            className="mr-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {replaceLabel}
          </Button>
        )}
        {input && !isMasked && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={onToggleShowKey}
            className="mr-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={showKey ? hideLabel : showLabel}
          >
            {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function GatewayKeyActionButtons({
  hasKey,
  isMasked,
  isDirty,
  busy,
  isSaving,
  saved,
  isRemoving,
  confirmRemove,
  saveLabel,
  savingLabel,
  savedLabel,
  removeLabel,
  removingLabel,
  confirmRemoveLabel,
  onRemove,
}: {
  hasKey: boolean;
  isMasked: boolean;
  isDirty: boolean;
  busy: boolean;
  isSaving: boolean;
  saved: boolean;
  isRemoving: boolean;
  confirmRemove: boolean;
  saveLabel: string;
  savingLabel: string;
  savedLabel: string;
  removeLabel: string;
  removingLabel: string;
  confirmRemoveLabel: string;
  onRemove: () => void;
}) {
  const saveButtonText = isSaving ? savingLabel : saved ? savedLabel : saveLabel;
  const removeButtonText = isRemoving ? removingLabel : confirmRemove ? confirmRemoveLabel : removeLabel;

  return (
    <div className="flex items-center gap-2">
      {!isMasked && (
        <Button
          type="submit"
          form="gateway-key-form"
          size="sm"
          disabled={!isDirty || busy}
          className="h-10 px-4 text-sm font-semibold"
        >
          {saveButtonText}
        </Button>
      )}
      {hasKey && (
        <Button
          type="button"
          size="sm"
          variant={confirmRemove ? "destructive" : "ghost"}
          onClick={onRemove}
          disabled={busy}
          className="h-10 px-4 text-sm font-medium"
        >
          {removeButtonText}
        </Button>
      )}
    </div>
  );
}
