import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("settings");

  if (isPending)
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
        {t("gateway.status.checking")}
      </span>
    );
  if (connected)
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-sm font-semibold text-success">
        {t("gateway.status.connected")}
      </span>
    );
  if (degraded)
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
        {t("gateway.status.degraded")}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground">
      {t("gateway.status.notConnected")}
    </span>
  );
}

function GatewayStat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 sm:block">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium tabular-nums sm:mt-1" title={title}>
        {value}
      </dd>
    </div>
  );
}

function GatewayCardHeader({
  connected,
  degraded,
  isPending,
}: {
  connected: boolean;
  degraded: boolean;
  isPending: boolean;
}) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 id="gateway-heading" className="text-base font-semibold tracking-tight">
        {t("gateway.title")}
      </h2>
      <GatewayStatusBadge connected={connected} degraded={degraded} isPending={isPending} />
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
  const { t } = useTranslation("settings");

  return (
    <dl className="grid gap-3 sm:flex sm:gap-12">
      <GatewayStat label={t("gateway.stats.models")} value={String(modelCount)} />
      <GatewayStat
        label={t("gateway.stats.balance")}
        value={balance ?? "—"}
        title={rawBalance}
      />
      <GatewayStat label={t("gateway.stats.used")} value={used ?? "—"} title={rawUsed} />
    </dl>
  );
}

function GatewayCardFooter({
  checkedAt,
  isRefreshing,
  disabled,
  onRefresh,
}: {
  checkedAt?: string | null;
  isRefreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <div className="flex flex-col items-start gap-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          type="button"
          size="sm"
          variant="link"
          onClick={onRefresh}
          disabled={disabled}
          className="h-10 px-0 text-sm sm:h-8"
        >
          {isRefreshing && <RefreshCw className="size-3.5 motion-safe:animate-spin" />}
          {isRefreshing
            ? t("gateway.refresh.refreshing")
            : t("gateway.refresh.action")}
        </Button>
        <span>{t("gateway.refreshHint")}</span>
        {checkedAt && (
          <span>{t("gateway.lastChecked", { date: new Date(checkedAt).toLocaleString() })}</span>
        )}
      </div>
      <a
        href="https://vercel.com/docs/ai-gateway"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm transition-colors hover:text-foreground hover:underline"
      >
        {t("gateway.whatIsIt")}
      </a>
    </div>
  );
}

function GatewayDegradedAlert({ detail }: { detail: string }) {
  return (
    <div
      role="status"
      className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm leading-5 text-amber-700 dark:text-amber-300"
    >
      {detail}
    </div>
  );
}

function getGatewayDescription(
  t: TFunction<"settings">,
  isPending: boolean,
  usable: boolean,
  detail?: string | null,
): string {
  if (isPending) return t("gateway.description.checking");
  if (usable) return t("gateway.description.connected");
  return detail ?? t("gateway.description.missing");
}

export function GatewayCard() {
  const { t } = useTranslation("settings");
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
      toast.success(t("gateway.toast.modelsRefreshed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("gateway.toast.refreshFailed"));
    } finally {
      setIsRefreshing(false);
    }
  };

  const description = getGatewayDescription(t, isPending, usable, connection?.detail);

  return (
    <div className="flex flex-col gap-5">
      <GatewayCardHeader connected={connected} degraded={degraded} isPending={isPending} />

      <p className="max-w-2xl text-base leading-6 text-muted-foreground">{description}</p>

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

      <GatewayCardFooter
        checkedAt={connection?.checkedAt}
        isRefreshing={isRefreshing}
        disabled={isPending || isRefreshing}
        onRefresh={() => void handleRefreshModels()}
      />

      {degraded && connection?.degradedDetail && (
        <GatewayDegradedAlert detail={connection.degradedDetail} />
      )}
    </div>
  );
}
