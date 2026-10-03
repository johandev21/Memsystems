import { type VirtualItem, type Virtualizer, useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useEffect } from "react";
import { cn } from "@/shared/utils/cn";

export interface VirtualizedDocumentContainerProps<T> {
  items: T[];
  scrollElement: HTMLDivElement | null;
  estimateSize?: (index: number) => number;
  overscan?: number;
  renderItem: (item: T, index: number, isHighlighted: boolean) => ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  className?: string;
  targetIndex?: number | null;
  highlightedIndex?: number | null;
  shouldAdjustScrollPositionOnItemSizeChange?: (
    item: VirtualItem,
    delta: number,
    instance: Virtualizer<HTMLDivElement, Element>,
  ) => boolean;
}

export function VirtualizedDocumentContainer<T>({
  items,
  scrollElement,
  estimateSize = () => 60,
  overscan = 5,
  renderItem,
  getItemKey,
  className,
  targetIndex,
  highlightedIndex,
  shouldAdjustScrollPositionOnItemSizeChange,
}: VirtualizedDocumentContainerProps<T>) {
  // TanStack Virtual exposes non-memoizable functions; the compiler skipping
  // this component is the intended behavior.
  // eslint-disable-next-line react/incompatible-library -- third-party virtualizer API
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize,
    overscan,
    getItemKey: (index: number) => {
      if (getItemKey && items[index] !== undefined) {
        return getItemKey(items[index], index);
      }
      return index;
    },
    initialRect: { width: 800, height: 600 },
  });

  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, delta, instance) => {
    if (shouldAdjustScrollPositionOnItemSizeChange) {
      return shouldAdjustScrollPositionOnItemSizeChange(item, delta, instance);
    }
    // During forward (downward) scroll, suppress negative scroll adjustment (which pulls
    // the viewport upwards) to prevent the infinite scroll jump loop caused by height fluctuations.
    if (instance.scrollDirection === "forward" && delta < 0) {
      return false;
    }
    // During backward (upward) scroll, suppress positive scroll adjustment.
    if (instance.scrollDirection === "backward" && delta > 0) {
      return false;
    }
    return item.start < (instance.scrollOffset ?? 0);
  };

  useEffect(() => {
    if (typeof targetIndex === "number" && targetIndex >= 0 && targetIndex < items.length) {
      virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "smooth" });
    }
  }, [targetIndex, items.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  if (items.length === 0) return null;

  return (
    <div
      className={cn("relative", className || "w-full", "h-(--virtual-total)")}
      style={{ "--virtual-total": `${virtualizer.getTotalSize()}px` } as React.CSSProperties}
    >
      {virtualItems.map((virtualRow) => {
        const index = virtualRow.index;
        const item = items[index];
        const isHighlighted = highlightedIndex === index;

        return (
          <div
            key={virtualRow.key}
            data-index={index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full translate-y-(--virtual-start)"
            style={{ "--virtual-start": `${virtualRow.start}px` } as React.CSSProperties}
          >
            {renderItem(item, index, isHighlighted)}
          </div>
        );
      })}
    </div>
  );
}
