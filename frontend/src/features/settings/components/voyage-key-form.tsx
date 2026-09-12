import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useVoyageKeyForm } from "../hooks/use-voyage-key-form";

export function VoyageKeyForm({ hasKey }: { hasKey: boolean }) {
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
  } = useVoyageKeyForm(hasKey);

  return (
    <form id="voyage-key-form" onSubmit={handleSave} className="flex flex-col gap-2">
      <label htmlFor="voyage-key-input" className="text-sm font-medium text-foreground">
        {t("embeddings.apiKey.label")}
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="relative flex h-10 items-center rounded-2xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <input
              id="voyage-key-input"
              form="voyage-key-form"
              type={showKey ? "text" : "password"}
              placeholder={t("embeddings.apiKey.placeholder")}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                handleClearConfirmRemove();
              }}
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
                onClick={() => {
                  setInput("");
                  setShowKey(false);
                }}
                className="mr-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("embeddings.apiKey.replace")}
              </Button>
            )}
            {input && !isMasked && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => setShowKey((current) => !current)}
                className="mr-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showKey ? t("embeddings.apiKey.hide") : t("embeddings.apiKey.show")}
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isMasked && (
            <Button
              type="submit"
              form="voyage-key-form"
              size="sm"
              disabled={!isDirty || busy}
              className="h-10 px-4 text-sm font-semibold"
            >
              {isSaving
                ? t("embeddings.apiKey.saving")
                : saved
                  ? t("embeddings.apiKey.saved")
                  : t("embeddings.apiKey.save")}
            </Button>
          )}
          {hasKey && (
            <Button
              type="button"
              size="sm"
              variant={confirmRemove ? "destructive" : "ghost"}
              onClick={() => void handleRemove()}
              disabled={busy}
              className="h-10 px-4 text-sm font-medium"
            >
              {isRemoving
                ? t("embeddings.apiKey.removing")
                : confirmRemove
                  ? t("embeddings.apiKey.confirmRemove")
                  : t("embeddings.apiKey.remove")}
            </Button>
          )}
        </div>
      </div>
      {confirmRemove && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("embeddings.apiKey.removeConfirm")}
        </p>
      )}
    </form>
  );
}
