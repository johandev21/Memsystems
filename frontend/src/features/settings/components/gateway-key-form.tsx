import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGatewayKeyForm } from "../hooks/use-gateway-key-form";

export function GatewayKeyForm({ hasKey }: { hasKey: boolean }) {
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
        Gateway API Key
      </label>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="relative flex h-10 items-center rounded-2xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <input
              id="gateway-key-input"
              form="gateway-key-form"
              type={showKey ? "text" : "password"}
              placeholder="Paste your Vercel AI Gateway key…"
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
                Replace
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
                aria-label={showKey ? "Hide gateway key" : "Show gateway key"}
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
              {isSaving ? "Saving…" : saved ? "Saved" : "Save Key"}
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
              {isRemoving ? "Removing…" : confirmRemove ? "Confirm Remove" : "Remove"}
            </Button>
          )}
        </div>
      </div>
      {confirmRemove && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Removing your key disconnects every model. Click again to confirm.
        </p>
      )}
    </form>
  );
}
