import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ScrollText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import type { AgentAccessLevel } from "@/shared/types/agent-access";
import {
  agentAccessQueryOptions,
  updateAgentAccessSettings,
  type AgentAccessSettings,
} from "../api/agent-access";
import { AgentAuditDialog } from "./agent-audit-dialog";
import { AgentKeysDialog } from "./agent-keys-dialog";

interface PolicyOption<T extends string> {
  value: T;
  label: string;
}

interface PolicyRowProps<T extends string> {
  id: string;
  title: string;
  description: string;
  value: T;
  options: readonly PolicyOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}

function PolicyRow<T extends string>({
  id,
  title,
  description,
  value,
  options,
  disabled,
  onChange,
}: PolicyRowProps<T>) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium text-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className={cn(
          "grid w-full gap-0.5 rounded-2xl bg-input/40 p-0.5 sm:w-auto sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none",
          options.length === 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-7 max-sm:min-h-11 touch-manipulation rounded-xl px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgentAccessCardSkeleton() {
  return (
    <div className="rounded-selector border border-border bg-card">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="border-b border-border p-4 last:border-b-0 sm:px-5">
          <Skeleton className="h-4 w-52 max-w-full" />
          <Skeleton className="mt-2 h-3 w-72 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export function AgentAccessCard() {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [keysOpen, setKeysOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery(agentAccessQueryOptions());

  const mutation = useMutation({
    mutationFn: updateAgentAccessSettings,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["agent-access"] });
      const previous = queryClient.getQueryData<AgentAccessSettings>(["agent-access"]);
      if (previous) {
        queryClient.setQueryData<AgentAccessSettings>(["agent-access"], {
          ...previous,
          ...patch,
        });
      }
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["agent-access"], context.previous);
      }
      toast.error(t("agentAccess.policies.saveFailed"));
    },
    onSuccess: () => {
      toast.success(t("agentAccess.policies.saved"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent-access"] });
    },
  });

  if (isLoading) {
    return <AgentAccessCardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-selector border border-border bg-card p-4 sm:p-5" role="alert">
        <p className="text-sm font-medium text-foreground">{t("agentAccess.policies.loadFailed")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("agentAccess.policies.loadFailedDescription")}
        </p>
        <Button variant="outline" size="sm" className="mt-3 max-sm:min-h-11" onClick={() => refetch()}>
          {t("agentAccess.retry")}
        </Button>
      </div>
    );
  }

  const disabled = mutation.isPending;

  return (
    <div className="rounded-selector border border-border bg-card">
      <div className="divide-y divide-border">
        <PolicyRow
          id="agent-soft-delete"
          title={t("agentAccess.policies.softDelete.title")}
          description={t("agentAccess.policies.softDelete.description")}
          value={data.softDelete}
          disabled={disabled}
          options={[
            { value: "ask", label: t("agentAccess.policies.ask") },
            { value: "allow", label: t("agentAccess.policies.allow") },
          ]}
          onChange={(softDelete) => mutation.mutate({ softDelete })}
        />
        <PolicyRow
          id="agent-permanent-delete"
          title={t("agentAccess.policies.permanentDelete.title")}
          description={t("agentAccess.policies.permanentDelete.description")}
          value={data.permanentDelete}
          disabled={disabled}
          options={[
            { value: "never", label: t("agentAccess.policies.never") },
            { value: "ask", label: t("agentAccess.policies.ask") },
          ]}
          onChange={(permanentDelete) => mutation.mutate({ permanentDelete })}
        />
        <PolicyRow
          id="agent-resource-delete"
          title={t("agentAccess.policies.resourceDelete.title")}
          description={t("agentAccess.policies.resourceDelete.description")}
          value={data.resourceDelete}
          disabled={disabled}
          options={[
            { value: "never", label: t("agentAccess.policies.never") },
            { value: "ask", label: t("agentAccess.policies.ask") },
          ]}
          onChange={(resourceDelete) => mutation.mutate({ resourceDelete })}
        />
        <PolicyRow<AgentAccessLevel>
          id="agent-notebook-default"
          title={t("agentAccess.policies.notebookDefault.title")}
          description={t("agentAccess.policies.notebookDefault.description")}
          value={data.notebookDefault}
          disabled={disabled}
          options={[
            { value: "on", label: t("agentAccess.levels.on") },
            { value: "read_only", label: t("agentAccess.levels.read_only") },
            { value: "off", label: t("agentAccess.levels.off") },
          ]}
          onChange={(notebookDefault) => mutation.mutate({ notebookDefault })}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs leading-5 text-muted-foreground">
          {t("agentAccess.cardHint")}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="sm"
            className="max-sm:min-h-11"
            onClick={() => setKeysOpen(true)}
          >
            <KeyRound />
            {t("agentAccess.keys.manage")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="max-sm:min-h-11"
            onClick={() => setAuditOpen(true)}
          >
            <ScrollText />
            {t("agentAccess.audit.view")}
          </Button>
        </div>
      </div>

      <AgentKeysDialog
        open={keysOpen}
        onOpenChange={setKeysOpen}
        onViewActivity={() => {
          setKeysOpen(false);
          setAuditOpen(true);
        }}
      />
      <AgentAuditDialog open={auditOpen} onOpenChange={setAuditOpen} />
    </div>
  );
}
