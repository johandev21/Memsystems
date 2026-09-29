import { useTranslation } from "react-i18next";
import { InlineRename as SharedInlineRename } from "@/components/ui/tree";
import { useTreeControllerContext } from "../controller-state";

export type InlineRenameProps = {
  initialValue: string;
  onCancel: () => void;
  onCommit: (value: string) => void;
};

export function InlineRename({ initialValue, onCancel, onCommit }: InlineRenameProps) {
  const { t } = useTranslation("tree");
  const controller = useTreeControllerContext();

  return (
    <SharedInlineRename
      initialValue={initialValue}
      onCancel={onCancel}
      onCommit={onCommit}
      ariaLabel={t("row.itemName")}
      size={controller.size}
      className="min-w-0 flex-1 truncate h-auto rounded-none border-0 bg-transparent px-0 py-0 font-sans text-sm font-normal leading-none tracking-normal outline-none placeholder:text-muted-foreground/60 selection:bg-primary/20 selection:text-foreground focus:border-0 focus:bg-transparent focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
    />
  );
}
