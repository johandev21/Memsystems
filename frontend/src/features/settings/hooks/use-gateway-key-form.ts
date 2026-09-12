import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { saveGatewayKey, deleteGatewayKey } from "../api/gateway";

export const MASKED_GATEWAY_KEY = "••••••••••••••••••••••••••••••••";

export function useGatewayKeyForm(hasKey: boolean) {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [prevHasKey, setPrevHasKey] = useState(hasKey);
  const [input, setInput] = useState(hasKey ? MASKED_GATEWAY_KEY : "");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false);

  if (prevHasKey !== hasKey) {
    setPrevHasKey(hasKey);
    setInput(hasKey ? MASKED_GATEWAY_KEY : "");
    setShowKey(false);
    setConfirmRemove(false);
  }

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
      await saveGatewayKey(input.trim());
      setSaved(true);
      toast.success(t("gateway.toast.saved"));
      invalidate();
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("gateway.toast.saveFailed"));
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
      await deleteGatewayKey();
      toast.success(t("gateway.toast.removed"));
      setInput("");
      setShowKey(false);
      setConfirmRemove(false);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("gateway.toast.removeFailed"));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleClearConfirmRemove = () => {
    if (confirmRemove) setConfirmRemove(false);
  };

  return {
    input,
    setInput,
    showKey,
    setShowKey,
    isMasked,
    isDirty,
    isSaving,
    isRemoving,
    confirmRemove,
    saved,
    busy,
    handleSave,
    handleRemove,
    handleClearConfirmRemove,
  };
}
