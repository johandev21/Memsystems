import { SOURCE_LIMIT } from "../../api/sources";

export interface SourceLimitMeterProps {
  count: number;
  usedPercent: number;
}

export function SourceLimitMeter({ count, usedPercent }: SourceLimitMeterProps) {
  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>Sources used</span>
        <span className="text-foreground">
          {count} / {SOURCE_LIMIT}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
      </div>
    </div>
  );
}
