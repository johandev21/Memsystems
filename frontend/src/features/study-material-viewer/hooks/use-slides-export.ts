import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { downloadSlidesPptx } from "../api/study-materials";

export function useSlidesExport(materialId: string, materialTitle: string) {
  const { t } = useTranslation("viewer");
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadPptx = async () => {
    setIsDownloading(true);
    try {
      await downloadSlidesPptx(materialId, materialTitle || "slides");
      toast.success(t("slides.exportedToast"));
    } catch {
      toast.error(t("slides.exportFailedToast"));
    } finally {
      setIsDownloading(false);
    }
  };

  return { isDownloading, downloadPptx };
}
