import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchVoyageConnection, reembedAllSources } from "../api/embeddings";
import { VoyageKeyForm } from "./voyage-key-form";

function EmbeddingsStatusBadge({
  connected,
  isPending,
}: {
  connected: boolean;
  isPending: boolean;
}) {
  const { t } = useTranslation("settings");

  if (isPending)
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
        {t("embeddings.status.checking")}
      </span>
    );
  if (connected)
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-sm font-semibold text-success">
        {t("embeddings.status.connected")}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
      {t("embeddings.status.notConnected")}
    </span>
  );
}

export function EmbeddingsCard() {
  const { t } = useTranslation("settings");
  const [isReembedding, setIsReembedding] = useState(false);

  const { data: connection, isPending } = useQuery({
    queryKey: ["voyage-connection"],
    queryFn: fetchVoyageConnection,
    staleTime: 60_000,
    retry: 1,
  });

  const connected = connection?.hasKey ?? false;

  const handleReembed = async () => {
    setIsReembedding(true);
    try {
      const { enqueued } = await reembedAllSources();
      toast.success(t("embeddings.toast.reembedQueued", { count: enqueued }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("embeddings.toast.reembedFailed"));
    } finally {
      setIsReembedding(false);
    }
  };

  const description = isPending
    ? t("embeddings.description.checking")
    : connected
      ? t("embeddings.description.connected")
      : t("embeddings.description.missing");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="embeddings-heading" className="text-base font-semibold tracking-tight">
          {t("embeddings.title")}
        </h2>
        <EmbeddingsStatusBadge connected={connected} isPending={isPending} />
      </div>

      <p className="max-w-2xl text-base leading-6 text-muted-foreground">{description}</p>

      <VoyageKeyForm hasKey={connected} />

      {connected && connection && (
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleReembed()}
            disabled={isReembedding}
            className="h-10 px-4 text-sm font-semibold"
          >
            {isReembedding && <RefreshCw className="size-3.5 motion-safe:animate-spin" />}
            {isReembedding
              ? t("embeddings.reembed.actionRunning")
              : t("embeddings.reembed.action")}
          </Button>
          <span>
            {t("embeddings.modelInfo", {
              model: connection.model,
              dimensions: connection.dimensions,
            })}
          </span>
          <span>{t("embeddings.reembed.hint")}</span>
        </div>
      )}

      <a
        href="https://www.voyageai.com"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm transition-colors hover:text-foreground hover:underline"
      >
        {t("embeddings.whatIsIt")}
      </a>
    </div>
  );
}
