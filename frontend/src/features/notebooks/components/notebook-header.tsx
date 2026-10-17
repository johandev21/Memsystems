import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Logo, SettingsLink } from "@/components/layout";
import { exportNotebook, notebookQueryOptions } from "../api/notebooks";
import { EditableNotebookTitle } from "./editable-notebook-title";
import { MobileNotebookMenuDrawer } from "./mobile-notebook-menu-drawer";

export function NotebookHeader({ id }: { id: string }) {
  const { t } = useTranslation("notebooks");
  const { data: notebook } = useQuery(notebookQueryOptions(id));
  const [isExporting, setIsExporting] = useState(false);
  const folderId = notebook?.folderId;

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      toast.loading(t("settings.exporting", "Exporting notebook…"), { id: `export-${id}` });
      await exportNotebook(id, notebook?.title);
      toast.success(t("settings.exportSuccess", "Notebook exported successfully"), {
        id: `export-${id}`,
      });
    } catch {
      toast.error(t("settings.exportFailed", "Failed to export notebook"), {
        id: `export-${id}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="flex h-11 sm:h-12 items-center justify-between px-3 sm:px-6 lg:px-8 bg-background shrink-0 gap-2 pt-safe-header">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Link
          to="/"
          search={folderId ? { folderId } : undefined}
          className="flex items-center gap-1.5 hover:opacity-90 transition-opacity select-none shrink-0"
        >
          <Logo className="size-6 text-foreground" />
        </Link>
        <span className="hidden sm:inline text-muted-foreground/40 font-mono text-xs select-none shrink-0">
          /
        </span>
        <div className="min-w-0 flex-1">
          <EditableNotebookTitle id={id} />
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1">
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            aria-label={t("settings.export", "Export notebook")}
            title={t("settings.export", "Export notebook")}
            className="flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none disabled:opacity-50"
          >
            <Download className="size-4" />
          </button>
          <SettingsLink />
        </div>
        <div className="sm:hidden">
          <MobileNotebookMenuDrawer notebookId={id} />
        </div>
      </div>
    </header>
  );
}
