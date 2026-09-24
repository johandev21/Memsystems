import { Search } from "lucide-react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { cn } from "@/shared/utils/cn";
import { CURATED_CATEGORIES, formatIconLabel, type CuratedCategory } from "./icon-picker-data";

export interface IconItemProps {
  name: string;
  isSelected: boolean;
  isFocused: boolean;
  onClick: (name: string) => void;
  onMouseEnter: (name: string) => void;
}

export const IconItem = memo(function IconItem({
  name,
  isSelected,
  isFocused,
  onClick,
  onMouseEnter,
}: IconItemProps) {
  const label = useMemo(() => formatIconLabel(name), [name]);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={() => onClick(name)}
      onMouseEnter={() => onMouseEnter(name)}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-foreground outline-none transition-colors duration-150",
        isSelected
          ? "bg-accent text-accent-foreground"
          : isFocused
            ? "bg-muted text-foreground ring-1 ring-ring/50"
            : "hover:bg-muted/60",
      )}
    >
      <DynamicIcon name={name} className="size-4 shrink-0" />
    </button>
  );
});

export interface IconPickerGridProps {
  isSearching: boolean;
  matchingIcons: string[];
  displayedMatchingIcons: string[];
  currentIcons: string[];
  value: string | null;
  focusedIndex: number;
  onSelect: (name: string) => void;
  onMouseEnter: (name: string) => void;
  categories?: CuratedCategory[];
}

export function IconPickerGrid({
  isSearching,
  matchingIcons,
  displayedMatchingIcons,
  currentIcons,
  value,
  focusedIndex,
  onSelect,
  onMouseEnter,
  categories = CURATED_CATEGORIES,
}: IconPickerGridProps) {
  const { t } = useTranslation();

  if (isSearching) {
    if (matchingIcons.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Search className="size-8 mb-2 stroke-1 opacity-50" />
          <p className="text-xs font-medium">{t("iconPicker.noResults")}</p>
          <p className="text-xs opacity-75 mt-0.5">{t("iconPicker.tryAnother")}</p>
        </div>
      );
    }

    return (
      <>
        <div className="mb-1 flex h-9 items-center px-0.5 text-xs font-medium text-muted-foreground">
          {t("iconPicker.results")}
        </div>
        <div data-slot="icon-grid" className="grid grid-cols-6 gap-1 pb-1">
          {displayedMatchingIcons.map((iconName, index) => (
            <IconItem
              key={iconName}
              name={iconName}
              isSelected={value === iconName}
              isFocused={focusedIndex === index}
              onClick={onSelect}
              onMouseEnter={onMouseEnter}
            />
          ))}
        </div>
        {displayedMatchingIcons.length < matchingIcons.length && (
          <div className="flex h-10 items-center justify-center text-xs text-muted-foreground">
            {t("iconPicker.scrollForMore")}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col">
      {categories.map((category) => (
        <div key={category.labelKey} className="flex flex-col">
          <div className="mb-1 flex h-9 items-center px-0.5 text-xs font-medium text-muted-foreground">
            {t(category.labelKey)}
          </div>
          <div data-slot="icon-grid" className="grid grid-cols-6 gap-1 pb-1">
            {category.icons.map((iconName) => {
              const globalIdx = currentIcons.indexOf(iconName);
              return (
                <IconItem
                  key={iconName}
                  name={iconName}
                  isSelected={value === iconName}
                  isFocused={focusedIndex === globalIdx}
                  onClick={onSelect}
                  onMouseEnter={onMouseEnter}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
