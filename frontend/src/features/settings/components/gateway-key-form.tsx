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
        <div className="flex-1">
          <div className="relative flex h-10 items-center rounded-2xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <input
              id="gateway-key-input"
              form="gateway-key-form"
              type={showKey ? "text" : "password"}
              placeholder={t("gateway.apiKey.placeholder")}
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
                {t("gateway.apiKey.replace")}
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
                aria-label={showKey ? t("gateway.apiKey.hide") : t("gateway.apiKey.show")}
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
              form="gateway-key-form"
              size="sm"
              disabled={!isDirty || busy}
              className="h-10 px-4 text-sm font-semibold"
            >
              {isSaving
                ? t("gateway.apiKey.saving")
                : saved
                  ? t("gateway.apiKey.saved")
                  : t("gateway.apiKey.save")}
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
                ? t("gateway.apiKey.removing")
                : confirmRemove
                  ? t("gateway.apiKey.confirmRemove")
                  : t("gateway.apiKey.remove")}
            </Button>
          )}
        </div>
      </div>
      {confirmRemove && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("gateway.apiKey.removeConfirm")}
        </p>
      )}
    </form>
  );
}
