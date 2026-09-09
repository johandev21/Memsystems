import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useConnectionStatus } from "@/features/ai";
import { Button } from "@/components/ui/button";
import { fetchGatewayCredits, refreshGatewayModels } from "../api/gateway";
import { GatewayKeyForm } from "./gateway-key-form";

function formatCredits(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 4 });
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

function GatewayCardHeader({
  connected,
  degraded,
  isPending,
  isRefreshing,
  onRefresh,
}: {
  connected: boolean;
  degraded: boolean;
  isPending: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h3 className="text-sm font-semibold tracking-[-0.01em]">AI Gateway</h3>
      <GatewayStatusBadge connected={connected} degraded={degraded} isPending={isPending} />
      <div className="ms-auto">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          disabled={isPending || isRefreshing}
          className="h-9 min-w-20 rounded-xl text-xs font-semibold shadow-sm"
        >
          {isRefreshing ? <RefreshCw className="size-3.5 animate-spin" /> : "Refresh models"}
        </Button>
      </div>
    </div>
  );
}

function GatewayStatsGrid({
  modelCount,
  balance,
  rawBalance,
  used,
  rawUsed,
}: {
  modelCount: number;
  balance: string | null;
  rawBalance?: string;
  used: string | null;
  rawUsed?: string;
}) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <GatewayStat label="Models included" value={String(modelCount)} />
      <GatewayStat
        label="Balance"
        value={balance ? `${balance} credits` : "—"}
        title={rawBalance}
      />
      <GatewayStat
        label="Credits used"
        value={used ?? "—"}
        title={rawUsed}
      />
    </dl>
  );
}

function GatewayCardFooter({ checkedAt }: { checkedAt?: string | null }) {
  return (
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
      {checkedAt && (
        <span>Last checked {new Date(checkedAt).toLocaleString()}</span>
      )}
    </div>
  );
}

function GatewayDegradedAlert({ detail }: { detail: string }) {
  return (
    <div className="border-t border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs leading-5 text-amber-700 sm:px-6 dark:text-amber-300">
      {detail}
    </div>
  );
}

function getGatewayDescription(
  isPending: boolean,
  usable: boolean,
  modelCount: number,
  detail?: string | null
): string {
  if (isPending) return "Checking gateway status…";
  if (usable) return `Every notebook can use ${modelCount} models through your gateway key.`;
  return detail ?? "Add your AI Gateway key below to connect every model.";
}

export function GatewayCard() {
  const { data: connection, isPending } = useConnectionStatus();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: credits } = useQuery({
    queryKey: ["gateway-credits"],
    queryFn: fetchGatewayCredits,
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
      await refreshGatewayModels();
      await queryClient.invalidateQueries({ queryKey: ["connection-status"] });
      await queryClient.invalidateQueries({ queryKey: ["models"] });
      toast.success("Model list refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh the model list");
    } finally {
      setIsRefreshing(false);
    }
  };

  const description = getGatewayDescription(
    isPending,
    usable,
    modelCount,
    connection?.detail
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_8px_30px_rgb(15_23_42/0.035)]">
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <GatewayCardHeader
          connected={connected}
          degraded={degraded}
          isPending={isPending}
          isRefreshing={isRefreshing}
          onRefresh={() => void handleRefreshModels()}
        />

        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>

        <GatewayKeyForm hasKey={connection?.gateway.hasKey ?? false} />

        {usable && (
          <GatewayStatsGrid
            modelCount={modelCount}
            balance={balance}
            rawBalance={credits?.balance}
            used={used}
            rawUsed={credits?.totalUsed}
          />
        )}

        <GatewayCardFooter checkedAt={connection?.checkedAt} />
      </div>

      {degraded && connection?.degradedDetail && (
        <GatewayDegradedAlert detail={connection.degradedDetail} />
      )}
    </div>
  );
}
