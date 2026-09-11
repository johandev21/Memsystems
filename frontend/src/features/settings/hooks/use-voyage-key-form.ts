import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { deleteVoyageKey, saveVoyageKey } from "../api/embeddings";

export const MASKED_VOYAGE_KEY = "••••••••••••••••••••••••••••••••";

export function useVoyageKeyForm(hasKey: boolean) {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [prevHasKey, setPrevHasKey] = useState(hasKey);
  const [input, setInput] = useState(hasKey ? MASKED_VOYAGE_KEY : "");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false);

  if (prevHasKey !== hasKey) {
    setPrevHasKey(hasKey);
    setInput(hasKey ? MASKED_VOYAGE_KEY : "");
    setShowKey(false);
    setConfirmRemove(false);
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["voyage-connection"] });
  };

  const isMasked = input === MASKED_VOYAGE_KEY;
  const isDirty = Boolean(input.trim()) && !isMasked;
  const busy = isSaving || isRemoving;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!isDirty || busy) return;
    setIsSaving(true);
    try {
      await saveVoyageKey(input.trim());
      setSaved(true);
      toast.success(t("embeddings.toast.saved"));
      invalidate();
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("embeddings.toast.saveFailed"));
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
      await deleteVoyageKey();
      toast.success(t("embeddings.toast.removed"));
      setInput("");
      setShowKey(false);
      setConfirmRemove(false);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("embeddings.toast.removeFailed"));
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
