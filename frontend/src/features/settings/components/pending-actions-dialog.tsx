import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AGENT_ACTIONS_REFETCH_INTERVAL_MS,
  agentPendingActionsQueryOptions,
  approveAgentAction,
  rejectAgentAction,
  type AgentPendingAction,
} from "../api/agent-access";
import { formatDateTime } from "../utils/format-datetime";

export interface PendingActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PendingActionRow({
  action,
  locale,
}: {
  action: AgentPendingAction;
  locale: string;
}) {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
    void queryClient.invalidateQueries({ queryKey: ["agent-audit"] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveAgentAction(action.id),
    onSuccess: () => {
      toast.success(t("agentAccess.pendingActions.approved"));
      invalidate();
    },
    onError: () => {
      toast.error(t("agentAccess.pendingActions.approveFailed"));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectAgentAction(action.id),
    onSuccess: () => {
      toast.success(t("agentAccess.pendingActions.rejected"));
      invalidate();
    },
    onError: () => {
      toast.error(t("agentAccess.pendingActions.rejectFailed"));
    },
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t(`agentAccess.pendingActions.status.${action.status}`)}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {action.toolName}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("agentAccess.pendingActions.expires", {
            date: formatDateTime(action.expiresAt, locale),
          })}
        </span>
      </div>

      <p className="mt-2 text-sm leading-5 text-foreground">{action.summary}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t("agentAccess.pendingActions.keyLabel", {
            name:
              action.agentKeyName ?? t("agentAccess.pendingActions.noKey"),
          })}
        </span>
        <span>
          {t("agentAccess.pendingActions.target", {
            target: t(
              `agentAccess.pendingActions.targetType.${action.targetType}`,
            ),
          })}
        </span>
      </div>

      {action.errorMessage ? (
        <p className="mt-2 text-xs leading-5 text-destructive">
          {action.errorMessage}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-sm:min-h-11"
          disabled={busy}
          onClick={() => rejectMutation.mutate()}
        >
          {rejectMutation.isPending
            ? t("agentAccess.pendingActions.rejecting")
            : t("agentAccess.pendingActions.reject")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="max-sm:min-h-11"
          disabled={busy}
          onClick={() => approveMutation.mutate()}
        >
          {approveMutation.isPending
            ? t("agentAccess.pendingActions.approving")
            : t("agentAccess.pendingActions.approve")}
        </Button>
      </div>
    </li>
  );
}

export function PendingActionsDialog({
  open,
  onOpenChange,
}: PendingActionsDialogProps) {
  const { t, i18n } = useTranslation("settings");
  const query = useQuery({
    ...agentPendingActionsQueryOptions(),
    enabled: open,
    refetchInterval: open ? AGENT_ACTIONS_REFETCH_INTERVAL_MS : false,
  });

  const actions = query.data?.actions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("agentAccess.pendingActions.title")}</DialogTitle>
          <DialogDescription>
            {t("agentAccess.pendingActions.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto pr-1">
          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="rounded-2xl border border-border p-4" role="alert">
              <p className="text-sm font-medium">
                {t("agentAccess.pendingActions.loadFailed")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 max-sm:min-h-11"
                onClick={() => query.refetch()}
              >
                {t("agentAccess.retry")}
              </Button>
            </div>
          ) : actions.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="size-6 text-muted-foreground" />}
              title={t("agentAccess.pendingActions.emptyTitle")}
              description={t("agentAccess.pendingActions.emptyDescription")}
              className="py-10"
            />
          ) : (
            <ul className="space-y-2">
              {actions.map((action) => (
                <PendingActionRow
                  key={action.id}
                  action={action}
                  locale={i18n.language}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
