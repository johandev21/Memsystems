import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, KeyRound, ScrollText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  agentKeysQueryOptions,
  createAgentKey,
  revokeAgentKey,
  type AgentKey,
  type CreatedAgentKey,
} from "../api/agent-access";
import { formatDateTime } from "../utils/format-datetime";

export interface AgentKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewActivity: () => void;
}

export function AgentKeysDialog({ open, onOpenChange, onViewActivity }: AgentKeysDialogProps) {
  const { t, i18n } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedAgentKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AgentKey | null>(null);
  const [copied, setCopied] = useState(false);

  const keysQuery = useQuery({
    ...agentKeysQueryOptions(),
    enabled: open,
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCreatedKey(null);
      setCopied(false);
      setRevokeTarget(null);
    }
    onOpenChange(next);
  };

  const createMutation = useMutation({
    mutationFn: createAgentKey,
    onSuccess: (result) => {
      setCreatedKey(result);
      setCopied(false);
      setName("");
      toast.success(t("agentAccess.keys.created"));
      void queryClient.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: () => {
      toast.error(t("agentAccess.keys.createFailed"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeAgentKey,
    onSuccess: () => {
      setRevokeTarget(null);
      toast.success(t("agentAccess.keys.revoked"));
      void queryClient.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: () => {
      toast.error(t("agentAccess.keys.revokeFailed"));
    },
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || createMutation.isPending) return;
    createMutation.mutate(trimmed);
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      toast.success(t("agentAccess.keys.copied"));
    } catch {
      toast.error(t("agentAccess.keys.copyFailed"));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("agentAccess.keys.title")}</DialogTitle>
            <DialogDescription>{t("agentAccess.keys.description")}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(100dvh-12rem)] space-y-5 overflow-y-auto pr-1">
            {createdKey ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {t("agentAccess.keys.copyNowTitle")}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {t("agentAccess.keys.copyWarning")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-background/80 px-3 py-2 font-mono text-xs break-all text-foreground ring-1 ring-border">
                    {createdKey.key}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-sm:min-h-11"
                    onClick={handleCopy}
                  >
                    {copied ? <Check /> : <Copy />}
                    {copied ? t("agentAccess.keys.copiedAction") : t("agentAccess.keys.copy")}
                  </Button>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleCreate} className="flex flex-col gap-2">
              <Label htmlFor="agent-key-name">{t("agentAccess.keys.nameLabel")}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="agent-key-name"
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("agentAccess.keys.namePlaceholder")}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="max-sm:min-h-11"
                  disabled={!name.trim() || createMutation.isPending}
                >
                  <KeyRound />
                  {createMutation.isPending
                    ? t("agentAccess.keys.creating")
                    : t("agentAccess.keys.create")}
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">
                  {t("agentAccess.keys.listTitle")}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="max-sm:min-h-11 max-sm:px-2"
                  onClick={onViewActivity}
                >
                  <ScrollText />
                  {t("agentAccess.audit.view")}
                </Button>
              </div>

              {keysQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                  ))}
                </div>
              ) : keysQuery.isError ? (
                <div className="rounded-2xl border border-border p-3" role="alert">
                  <p className="text-sm font-medium">{t("agentAccess.keys.loadFailed")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 max-sm:min-h-11"
                    onClick={() => keysQuery.refetch()}
                  >
                    {t("agentAccess.retry")}
                  </Button>
                </div>
              ) : keysQuery.data && keysQuery.data.keys.length > 0 ? (
                <ul className="divide-y divide-border rounded-2xl border border-border">
                  {keysQuery.data.keys.map((key) => (
                    <li
                      key={key.id}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {key.name}
                          </span>
                          <Badge variant={key.revokedAt ? "outline" : "secondary"}>
                            {key.revokedAt
                              ? t("agentAccess.keys.status.revoked")
                              : t("agentAccess.keys.status.active")}
                          </Badge>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <code className="font-mono">{key.prefix}…</code>
                          <span>
                            {t("agentAccess.keys.createdAt", {
                              date: formatDateTime(key.createdAt, i18n.language),
                            })}
                          </span>
                          <span>
                            {key.lastUsedAt
                              ? t("agentAccess.keys.lastUsedAt", {
                                  date: formatDateTime(key.lastUsedAt, i18n.language),
                                })
                              : t("agentAccess.keys.neverUsed")}
                          </span>
                        </p>
                      </div>
                      {!key.revokedAt ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="max-sm:min-h-11"
                          onClick={() => setRevokeTarget(key)}
                        >
                          {t("agentAccess.keys.revoke")}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<KeyRound className="size-6 text-muted-foreground" />}
                  title={t("agentAccess.keys.emptyTitle")}
                  description={t("agentAccess.keys.emptyDescription")}
                  className="py-8"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("agentAccess.keys.revokeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("agentAccess.keys.revokeConfirmDescription", {
                name: revokeTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>
              {t("agentAccess.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => {
                if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
              }}
            >
              {revokeMutation.isPending
                ? t("agentAccess.keys.revoking")
                : t("agentAccess.keys.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
