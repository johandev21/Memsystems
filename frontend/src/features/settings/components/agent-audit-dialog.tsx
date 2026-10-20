import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ScrollText, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AGENT_AUDIT_PAGE_SIZE,
  agentAuditQueryOptions,
  agentKeysQueryOptions,
  clearAgentAudit,
  type AgentAuditEntry,
  type AgentAuditFilters,
  type AgentAuditStatus,
} from "../api/agent-access";
import { formatDateTime } from "../utils/format-datetime";

export interface AgentAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StatusFilter = "all" | AgentAuditStatus;
const ALL_KEYS = "all";
const ALL_STATUSES = "all";

const AUDIT_STATUSES: AgentAuditStatus[] = [
  "success",
  "error",
  "denied",
  "pending_approval",
];

function statusVariant(
  status: AgentAuditStatus,
): "secondary" | "destructive" | "outline" {
  if (status === "success") return "secondary";
  if (status === "error") return "destructive";
  return "outline";
}

function AuditEntryRow({
  entry,
  keyName,
  locale,
}: {
  entry: AgentAuditEntry;
  keyName: string;
  locale: string;
}) {
  const { t } = useTranslation("settings");

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(entry.status)}>
          {t(`agentAccess.audit.status.${entry.status}`)}
        </Badge>
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {entry.toolName}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDateTime(entry.createdAt, locale)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{t("agentAccess.audit.keyLabel", { name: keyName })}</span>
        {entry.durationMs !== null ? (
          <span>{t("agentAccess.audit.duration", { duration: entry.durationMs })}</span>
        ) : null}
        {entry.notebookId ? (
          <span className="truncate">
            {t("agentAccess.audit.notebook", { id: entry.notebookId })}
          </span>
        ) : null}
      </div>

      {entry.errorMessage ? (
        <p className="mt-2 text-xs leading-5 text-destructive">{entry.errorMessage}</p>
      ) : null}

      <Collapsible className="mt-2">
        <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          {t("agentAccess.audit.args")}
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-muted/40 p-2.5 font-mono text-xs leading-5 text-foreground">
            {JSON.stringify(entry.args, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export function AgentAuditDialog({ open, onOpenChange }: AgentAuditDialogProps) {
  const { t, i18n } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [keyId, setKeyId] = useState<string>(ALL_KEYS);
  const [status, setStatus] = useState<StatusFilter>(ALL_STATUSES);
  const [offset, setOffset] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) setOffset(0);
    onOpenChange(next);
  };

  const keysQuery = useQuery({
    ...agentKeysQueryOptions(),
    enabled: open,
  });

  const filters: AgentAuditFilters = {
    keyId: keyId === ALL_KEYS ? undefined : keyId,
    status: status === ALL_STATUSES ? undefined : status,
    limit: AGENT_AUDIT_PAGE_SIZE,
    offset,
  };

  const auditQuery = useQuery({
    ...agentAuditQueryOptions(filters),
    enabled: open,
  });

  const clearMutation = useMutation({
    mutationFn: clearAgentAudit,
    onSuccess: () => {
      setClearOpen(false);
      setOffset(0);
      toast.success(t("agentAccess.audit.cleared"));
      void queryClient.invalidateQueries({ queryKey: ["agent-audit"] });
    },
    onError: () => {
      toast.error(t("agentAccess.audit.clearFailed"));
    },
  });

  const keys = keysQuery.data?.keys ?? [];
  const keyOptions = [
    { value: ALL_KEYS, label: t("agentAccess.audit.allKeys") },
    ...keys.map((key) => ({ value: key.id, label: key.name })),
  ];
  const statusOptions = [
    { value: ALL_STATUSES, label: t("agentAccess.audit.allStatuses") },
    ...AUDIT_STATUSES.map((value) => ({
      value,
      label: t(`agentAccess.audit.status.${value}`),
    })),
  ];

  const total = auditQuery.data?.total ?? 0;
  const entries = auditQuery.data?.entries ?? [];
  const page = Math.floor(offset / AGENT_AUDIT_PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / AGENT_AUDIT_PAGE_SIZE));
  const hasNext = offset + AGENT_AUDIT_PAGE_SIZE < total;

  const keyNameFor = (id: string | null) => {
    if (!id) return t("agentAccess.audit.noKey");
    return keys.find((key) => key.id === id)?.name ?? t("agentAccess.audit.unknownKey");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("agentAccess.audit.title")}</DialogTitle>
            <DialogDescription>{t("agentAccess.audit.description")}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Select
                items={keyOptions}
                value={keyId}
                onValueChange={(value) => {
                  setKeyId(String(value));
                  setOffset(0);
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={t("agentAccess.audit.filterKey")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                items={statusOptions}
                value={status}
                onValueChange={(value) => {
                  setStatus(value as StatusFilter);
                  setOffset(0);
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={t("agentAccess.audit.filterStatus")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {auditQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : auditQuery.isError ? (
              <div className="rounded-2xl border border-border p-4" role="alert">
                <p className="text-sm font-medium">{t("agentAccess.audit.loadFailed")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 max-sm:min-h-11"
                  onClick={() => auditQuery.refetch()}
                >
                  {t("agentAccess.retry")}
                </Button>
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="size-6 text-muted-foreground" />}
                title={t("agentAccess.audit.emptyTitle")}
                description={t("agentAccess.audit.emptyDescription")}
                className="py-10"
              />
            ) : (
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <AuditEntryRow
                    key={entry.id}
                    entry={entry}
                    keyName={keyNameFor(entry.agentKeyId)}
                    locale={i18n.language}
                  />
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="max-sm:min-h-11"
                disabled={total === 0 || clearMutation.isPending}
                onClick={() => setClearOpen(true)}
              >
                <Trash2 />
                {t("agentAccess.audit.clear")}
              </Button>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-xs text-muted-foreground">
                  {t("agentAccess.audit.page", { page, pages: pageCount })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-sm:min-h-11"
                    disabled={offset === 0}
                    onClick={() => setOffset((current) => Math.max(0, current - AGENT_AUDIT_PAGE_SIZE))}
                  >
                    {t("agentAccess.audit.previous")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-sm:min-h-11"
                    disabled={!hasNext}
                    onClick={() => setOffset((current) => current + AGENT_AUDIT_PAGE_SIZE)}
                  >
                    {t("agentAccess.audit.next")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t("agentAccess.audit.clearConfirmTitle")}
        description={t("agentAccess.audit.clearConfirmDescription")}
        isLoading={clearMutation.isPending}
        onConfirm={() => clearMutation.mutate()}
      />
    </>
  );
}
