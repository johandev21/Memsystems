import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useConnectionStatus } from "@/features/ai";
import { SchemeSelector, ThemeGrid } from "@/features/theme";
import { AppHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/shared/api";

export function SettingsPage() {
  return <SettingsContent />;
}

function GatewayStatusBadge({
  connected,
  degraded,
  isPending,
}: {
  connected: boolean;
  degraded: boolean;
  isPending: boolean;
}) {
  if (isPending)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Checking
      </span>
    );
  if (connected)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="size-3" />
        Connected
      </span>
    );
  if (degraded)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <AlertCircle className="size-3" />
        Degraded
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      Not connected
    </span>
  );
}

function formatCredits(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function GatewayStat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-semibold tracking-tight" title={title}>
        {value}
      </dd>
    </div>
  );
}

const MASKED_GATEWAY_KEY = "••••••••••••••••••••••••••••••••";

async function readSaveError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // Fall through to the generic message.
  }
  return "Could not save this key";
}

function GatewayKeyForm({ hasKey }: { hasKey: boolean }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setInput(hasKey ? MASKED_GATEWAY_KEY : "");
    setShowKey(false);
    setConfirmRemove(false);
  }, [hasKey]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["connection-status"] });
    queryClient.invalidateQueries({ queryKey: ["models"] });
    queryClient.invalidateQueries({ queryKey: ["gateway-credits"] });
  };

  const isMasked = input === MASKED_GATEWAY_KEY;
  const isDirty = Boolean(input.trim()) && !isMasked;
  const busy = isSaving || isRemoving;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!isDirty || busy) return;
    setIsSaving(true);
    try {
      const res = await fetchApi("/api/ai/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayApiKey: input.trim() }),
      });
      if (!res.ok) throw new Error(await readSaveError(res));
      setSaved(true);
      toast.success("Gateway key saved");
      invalidate();
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setIsRemoving(true);
    try {
      const res = await fetchApi("/api/ai/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayApiKey: null }),
      });
      if (!res.ok) throw new Error(await readSaveError(res));
      setInput("");
      setConfirmRemove(false);
      toast.success("Gateway key removed");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this key");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href="https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          Get a key
        </a>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form id="gateway-key-form" onSubmit={handleSave} className="min-w-0 flex-1">
          <div className="relative flex h-10 items-center rounded-xl border border-border/70 bg-background shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-all focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/10">
            <KeyRound className="ml-3 size-3.5 shrink-0 text-muted-foreground/70" />
            <input
              id="gateway-key-input"
              type={showKey ? "text" : "password"}
              placeholder="Paste your Vercel AI Gateway key…"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setConfirmRemove(false);
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
        </form>
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

function GatewayCard() {
  const { data: connection, isPending } = useConnectionStatus();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: credits } = useQuery({
    queryKey: ["gateway-credits"],
    queryFn: async (): Promise<{ balance: string; totalUsed: string } | null> => {
      const res = await fetchApi("/api/ai/credits");
      if (!res.ok) return null;
      return (await res.json()) as { balance: string; totalUsed: string };
    },
    staleTime: 60_000,
    retry: 1,
  });

  const connected = connection?.ok ?? false;
  const degraded = connection?.degraded ?? false;
  const usable = connected || degraded;
  const modelCount = connection?.models.length ?? 0;
  const balance = formatCredits(credits?.balance);
  const used = formatCredits(credits?.totalUsed);

  const handleRefreshModels = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchApi("/api/ai/models/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Could not refresh the model list");
      await queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      await queryClient.invalidateQueries({ queryKey: ["models"] });
      toast.success("Model list refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh the model list");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_rgb(15_23_42/0.035)]">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold tracking-[-0.01em]">AI Gateway</h3>
          <GatewayStatusBadge connected={connected} degraded={degraded} isPending={isPending} />
          <div className="ms-auto">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void handleRefreshModels()}
              disabled={isPending || isRefreshing}
              className="h-9 min-w-20 rounded-xl text-xs font-semibold shadow-sm"
            >
              {isRefreshing ? <RefreshCw className="size-3.5 animate-spin" /> : "Refresh models"}
            </Button>
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {isPending
            ? "Checking gateway status…"
            : usable
              ? `Every notebook can use ${modelCount} models through your gateway key.`
              : (connection?.detail ?? "Add your AI Gateway key below to connect every model.")}
        </p>

        <GatewayKeyForm hasKey={connection?.gateway.hasKey ?? false} />

        {usable && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GatewayStat label="Models included" value={String(modelCount)} />
            <GatewayStat
              label="Balance"
              value={balance ? `${balance} credits` : "—"}
              title={credits?.balance ?? undefined}
            />
            <GatewayStat
              label="Credits used"
              value={used ?? "—"}
              title={credits?.totalUsed ?? undefined}
            />
          </dl>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <a
            href="https://vercel.com/docs/ai-gateway"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground hover:underline"
          >
            What is the gateway?
          </a>
          <span>Model list refreshes automatically every 6 hours.</span>
          {connection?.checkedAt && (
            <span>Last checked {new Date(connection.checkedAt).toLocaleString()}</span>
          )}
        </div>
      </div>

      {degraded && connection?.degradedDetail && (
        <div className="border-t border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs leading-5 text-amber-700 sm:px-6 dark:text-amber-300">
          {connection.degradedDetail}
        </div>
      )}
    </div>
  );
}

function SettingsContent() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1040px] px-5 pb-16 pt-10 sm:px-8 lg:pt-14">
        <header className="flex flex-col gap-6 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-none tracking-[-0.055em] sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Every notebook ships with models through the Vercel AI Gateway.
            </p>
          </div>
        </header>

        <section className="mt-9" aria-labelledby="gateway-heading">
          <div className="mb-3 px-1">
            <h2 id="gateway-heading" className="text-base font-semibold tracking-[-0.02em]">
              AI Gateway
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One gateway for every model. Bring your own key.
            </p>
          </div>
          <GatewayCard />
        </section>

        <section className="mt-8" aria-labelledby="appearance-heading">
          <div className="mb-3 px-1">
            <h2 id="appearance-heading" className="text-base font-semibold tracking-[-0.02em]">
              Appearance
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose how Memsystems looks. Theme sets the palette, color scheme sets light or dark.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_30px_rgb(15_23_42/0.025)] sm:p-6">
            <div className="space-y-8">
              <SchemeSelector />
              <ThemeGrid />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
