import { Check, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
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
    <div>
      <form id="gateway-key-form" onSubmit={handleSave} className="flex flex-col gap-2">
        <label htmlFor="gateway-key-input" className="text-xs font-medium text-foreground">
          Gateway API key
        </label>
      </form>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="relative flex h-10 items-center rounded-xl border border-border/70 bg-background shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/10">
            <KeyRound className="ml-3 size-3.5 shrink-0 text-muted-foreground/70" />
            <input
              id="gateway-key-input"
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
              <button
                type="button"
                onClick={() => {
                  setInput("");
                  setShowKey(false);
                }}
                className="mr-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Replace
              </button>
            )}
            {input && !isMasked && (
              <button
                type="button"
                onClick={() => setShowKey((current) => !current)}
                className="mr-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showKey ? "Hide gateway key" : "Show gateway key"}
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            form="gateway-key-form"
            size="sm"
            disabled={!isDirty || busy}
            className="h-10 rounded-xl px-4 text-xs font-semibold shadow-sm"
          >
            {isSaving ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : saved ? (
              <Check className="size-3.5" />
            ) : (
              "Save key"
            )}
          </Button>
          {hasKey && (
            <Button
              type="button"
              size="sm"
              variant={confirmRemove ? "destructive" : "outline"}
              onClick={() => void handleRemove()}
              disabled={busy}
              className="h-10 rounded-xl px-4 text-xs font-semibold"
            >
              {isRemoving ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : confirmRemove ? (
                "Confirm remove"
              ) : (
                "Remove"
              )}
            </Button>
          )}
        </div>
      </div>
      {confirmRemove && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Removing your key disconnects every model. Click again to confirm.
        </p>
      )}
    </div>
  );
}
