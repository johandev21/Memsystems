import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  AGENT_ACTIONS_REFETCH_INTERVAL_MS,
  agentPendingActionCountQueryOptions,
} from "../api/agent-access";
import { PendingActionsDialog } from "./pending-actions-dialog";

/**
 * Header badge for Pending Agent Actions. Renders nothing while the queue is
 * empty so the header stays unchanged for users who never connect an agent.
 */
export function PendingActionsIndicator() {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const query = useQuery({
    ...agentPendingActionCountQueryOptions(),
    refetchInterval: AGENT_ACTIONS_REFETCH_INTERVAL_MS,
  });

  const count = query.data?.pendingCount ?? 0;
  if (count <= 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="relative cursor-pointer rounded-full"
        aria-label={t("agentAccess.pendingActions.indicator", { count })}
        onClick={() => setOpen(true)}
      >
        <ShieldAlert className="size-4.5" />
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-destructive text-xs font-semibold leading-none text-white"
        >
          {count > 9 ? "9+" : count}
        </span>
      </Button>

      <PendingActionsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
