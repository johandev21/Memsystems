import type { LucideIcon } from "lucide-react";

export const MOBILE_TILE_CLASS =
  "flex w-full items-center rounded-xl transition-[background-color,transform] duration-150 ease-out active:bg-muted/60 active:scale-[0.99] select-none";

export function MobileTileActionsButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground touch-manipulation active:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}
