import { Anthropic, Deepseek, GoogleGemini, Kimi, Openai } from "@thesvg/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useConnectionStatus } from "@/features/ai";
import { SchemeSelector, ThemeGrid } from "@/features/theme";
import { AppHeader } from "@/components/layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/shared/api";

export function SettingsPage() {
  return <SettingsContent />;
}

const MASKED_KEY = "••••••••••••••••••••••••••••••••";

const providerConfig = [
  {
    id: "openai",
    name: "OpenAI",
    icon: Openai,
    placeholder: "sk-proj-...",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: Deepseek,
    placeholder: "sk-...",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: Anthropic,
    placeholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "google",
    name: "Google Gemini",
    icon: GoogleGemini,
    placeholder: "AIza...",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "kimi",
    name: "Kimi",
    icon: Kimi,
    placeholder: "sk-...",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
  },
] as const;

type Provider = (typeof providerConfig)[number];

function keyLooksValid(provider: Provider, value: string) {
  if (!value || value === MASKED_KEY) return true;
  if (provider.id === "anthropic") return value.startsWith("sk-ant-") && value.length > 15;
  if (provider.id === "google") return value.startsWith("AIza") && value.length > 15;
  return value.startsWith("sk-") && value.length > 15;
}

function ProviderMark({ provider }: { provider: Provider }) {
  const Icon = provider.icon;

  const monochromeClass =
    provider.id === "deepseek" || provider.id === "kimi" ? "" : "brightness-0 dark:invert";
  const kimiClass = provider.id === "kimi" ? "text-foreground" : "";

  return <Icon className={`size-7 shrink-0 ${monochromeClass} ${kimiClass}`} aria-hidden="true" />;
}

function StatusBadge({
  hasKey,
  ok,
  isPending,
  isInvalid,
}: {
  hasKey: boolean;
  ok: boolean;
  isPending: boolean;
  isInvalid: boolean;
}) {
  if (isPending)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Checking
      </span>
    );
  if (isInvalid || (hasKey && !ok))
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
        <AlertCircle className="size-3" />
        Invalid key
      </span>
    );
  if (hasKey && ok)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="size-3" />
        Connected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      Not configured
    </span>
  );
}

function ProviderKeyRow({ provider }: { provider: Provider }) {
  const { data: connection, isPending } = useConnectionStatus();
  const queryClient = useQueryClient();
  const providerStatus = connection?.providers?.[provider.id];
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setApiKeyInput(providerStatus?.hasKey ? MASKED_KEY : "");
  }, [providerStatus?.hasKey]);

  const isMasked = apiKeyInput === MASKED_KEY;
  const isDirty = Boolean(apiKeyInput.trim()) && !isMasked;
  const isInvalid = isDirty && !keyLooksValid(provider, apiKeyInput);

  const beginReplacement = () => {
    setApiKeyInput("");
    setShowKey(false);
    setReplaceOpen(false);
  };

  const handlePaste = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (value) {
        setApiKeyInput(value.trim());
        setPasted(true);
        window.setTimeout(() => setPasted(false), 1400);
      }
    } catch {
      toast.error("Clipboard access is unavailable");
    }
  };

  const handleSaveKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!isDirty || isInvalid) return;
    setIsSaving(true);
    try {
      const res = await fetchApi("/api/ai/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: apiKeyInput }),
      });
      if (!res.ok) throw new Error("Could not save this key");
      setSaved(true);
      toast.success(`${provider.name} key saved`);
      queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetchApi("/api/ai/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: null }),
      });
      if (!res.ok) throw new Error("Could not remove this key");
      setApiKeyInput("");
      setDeleteOpen(false);
      toast.success(`${provider.name} key removed`);
      queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this key");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="group grid gap-4 px-5 py-4 transition-colors hover:bg-muted/25 md:grid-cols-[minmax(185px,0.8fr)_minmax(260px,1.45fr)_auto] md:items-center md:gap-6 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <ProviderMark provider={provider} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold tracking-[-0.01em]">{provider.name}</h3>
            <StatusBadge
              hasKey={providerStatus?.hasKey ?? false}
              ok={providerStatus?.ok ?? false}
              isPending={isPending}
              isInvalid={isInvalid}
            />
          </div>
          <a
            href={provider.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Get an API key <ExternalLink className="size-2.5" />
          </a>
        </div>
      </div>

      <form id={`provider-form-${provider.id}`} onSubmit={handleSaveKey} className="min-w-0">
        <div
          className={`relative flex h-10 items-center rounded-xl border bg-background shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-all focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/10 ${isInvalid ? "border-destructive/60" : "border-border/70"}`}
        >
          <KeyRound className="ml-3 size-3.5 shrink-0 text-muted-foreground/70" />
          <input
            aria-label={`${provider.name} API key`}
            type={showKey ? "text" : "password"}
            placeholder={provider.placeholder}
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            readOnly={isMasked}
            disabled={isSaving || isDeleting}
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
          />
          {isMasked && (
            <button
              type="button"
              onClick={() => setReplaceOpen(true)}
              className="mr-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Replace
            </button>
          )}
          {!isMasked && (
            <button
              type="button"
              onClick={handlePaste}
              className="mr-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Paste API key"
            >
              {pasted ? (
                <Check className="size-3.5 text-success" />
              ) : (
                <Clipboard className="size-3.5" />
              )}
            </button>
          )}
          {apiKeyInput && (
            <button
              type="button"
              onClick={() => setShowKey((current) => !current)}
              className="mr-2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          )}
          {isDirty && (
            <span
              className={`mr-3 size-1.5 rounded-full ${isInvalid ? "bg-destructive" : "bg-success"}`}
              aria-label={isInvalid ? "Invalid key format" : "Key format looks valid"}
            />
          )}
        </div>
        {isInvalid && (
          <p className="mt-1.5 text-xs text-destructive">
            That key format doesn&apos;t look right.
          </p>
        )}
      </form>

      <div className="flex items-center gap-2 md:justify-end">
        <Button
          type="submit"
          form={`provider-form-${provider.id}`}
          size="sm"
          disabled={!isDirty || isInvalid || isSaving || isDeleting}
          className="h-9 min-w-20 rounded-xl text-xs font-semibold shadow-sm"
        >
          {isSaving ? (
            <RefreshCw className="size-3.5 animate-spin" />
          ) : saved ? (
            <Check className="size-3.5" />
          ) : (
            "Save changes"
          )}
        </Button>
        {providerStatus?.hasKey && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteOpen(true)}
            disabled={isSaving || isDeleting}
            aria-label={`Delete ${provider.name} API key`}
            className="size-9 rounded-xl text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
          >
            {isDeleting ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        )}
      </div>

      <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace {provider.name} key?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current key will stay active until you save a replacement. You will need to paste
              the new key on the next step.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={beginReplacement}>Replace key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {provider.name} key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect {provider.name} from your account. You can add the key again at
              any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <RefreshCw className="size-3.5 animate-spin" /> : "Remove key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingsContent() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1040px] px-5 pb-16 pt-10 sm:px-8 lg:pt-14">
        <header className="flex flex-col gap-6  pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold leading-none tracking-[-0.055em] sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Connect the AI providers you trust. Keys stay private to your account and power your
              notebooks.
            </p>
          </div>
        </header>

        <section className="mt-9" aria-labelledby="providers-heading">
          <div className="mb-3 flex items-end justify-between px-1">
            <div>
              <h2 id="providers-heading" className="text-base font-semibold tracking-[-0.02em]">
                AI providers
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Use your own keys for more control over models and usage.
              </p>
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <ShieldCheck className="size-3.5" /> Encrypted at rest
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_rgb(15_23_42/0.035)] divide-y divide-border/60">
            {providerConfig.map((provider) => (
              <ProviderKeyRow key={provider.id} provider={provider} />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_30px_rgb(15_23_42/0.025)] sm:p-6">
            <div className="flex items-start gap-3">
              <div>
                <h2 className="text-sm font-semibold">Your keys, your control</h2>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Keys are encrypted before they are stored and are only used to make requests on
                  your behalf. They are never exposed in the client.
                </p>
              </div>
            </div>
          </div>
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
