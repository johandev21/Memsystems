import { useTranslation } from "react-i18next";
import { SOURCE_LIMIT } from "../../api/sources";

export interface SourceLimitMeterProps {
  count: number;
  usedPercent: number;
}

export function SourceLimitMeter({ count, usedPercent }: SourceLimitMeterProps) {
  const { t } = useTranslation("sources");
  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>{t("menu.sourcesUsed")}</span>
        <span className="text-foreground">
          {count} / {SOURCE_LIMIT}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary w-(--meter-width)"
          style={{ "--meter-width": `${usedPercent}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
