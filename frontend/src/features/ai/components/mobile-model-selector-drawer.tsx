import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/shared/utils/cn";
import type { ModelOption } from "../types/model.types";
import { getProviderName } from "../utils/model-providers";
import { ModelSelectorLogo } from "./model-selector";

export interface MobileModelSelectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactElement;
  groups: Record<string, ModelOption[]>;
  selectedModel: string;
  onSelect: (modelId: string) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
  title?: ReactNode;
  searchPlaceholder?: string;
  emptyLabel?: string;
  capabilitiesVerified?: boolean;
}

export function MobileModelSelectorDrawer({
  open,
  onOpenChange,
  trigger,
  groups,
  selectedModel,
  onSelect,
  search,
  onSearchChange,
  title,
  searchPlaceholder,
  emptyLabel,
}: MobileModelSelectorDrawerProps) {
  const { t } = useTranslation(["chat", "ai", "common"]);
  const [internalSearch, setInternalSearch] = useState("");

  const isControlledSearch = search !== undefined && onSearchChange !== undefined;
  const searchQuery = isControlledSearch ? search : internalSearch;

  const handleSearchChange = (value: string) => {
    if (isControlledSearch) {
      onSearchChange(value);
    } else {
      setInternalSearch(value);
    }
  };

  const filteredGroups = useMemo(() => {
    if (isControlledSearch) {
      return groups;
    }
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();
    const result: Record<string, ModelOption[]> = {};
    for (const [provider, models] of Object.entries(groups)) {
      const matched = models.filter(
        (m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          provider.toLowerCase().includes(q),
      );
      if (matched.length > 0) {
        result[provider] = matched;
      }
    }
    return result;
  }, [groups, searchQuery, isControlledSearch]);

  const isEmpty = Object.values(filteredGroups).every((models) => models.length === 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerContent className="max-h-[85dvh] flex flex-col p-4 pt-3 pb-safe-lg border-t border-border/40 bg-background text-foreground shadow-2xl rounded-t-3xl">
        <DrawerHeader className="p-0 pb-3 pr-10 text-left shrink-0">
          <DrawerTitle className="text-base font-semibold text-foreground">
            {title ?? t("chat:composer.selectModelTitle", "Select Model")}
          </DrawerTitle>
        </DrawerHeader>

        <div className="pb-3 shrink-0">
          <div className="relative flex items-center rounded-xl border border-border/80 bg-muted/40 px-3 py-2 transition-all duration-150 focus-within:border-ring focus-within:bg-muted/70 focus-within:ring-2 focus-within:ring-ring/20 hover:border-border hover:bg-muted/60">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground mr-2.5" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={
                searchPlaceholder ??
                t("chat:composer.searchPlaceholder", "Search models...")
              }
              aria-label={
                searchPlaceholder ??
                t("chat:composer.searchPlaceholder", "Search models...")
              }
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none p-0 h-6"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                className="size-5 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 flex items-center justify-center text-muted-foreground active:scale-95 touch-manipulation ml-1 cursor-pointer shrink-0"
                aria-label={t("common:clear", "Clear search")}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>
        </div>

        <div
          role="listbox"
          aria-label={
            typeof title === "string"
              ? title
              : t("chat:composer.selectModelTitle", "Select Model")
          }
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-0.5 pb-2"
        >
          {isEmpty ? (
            <div className="py-12 px-4 text-center text-sm text-muted-foreground">
              {emptyLabel ?? t("chat:composer.noModelsFound", "No models found")}
            </div>
          ) : (
            Object.entries(filteredGroups).map(([provider, models]) => {
              if (models.length === 0) return null;
              return (
                <div key={provider} className="py-1.5 first:pt-0">
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground select-none">
                    {getProviderName(provider)}
                  </div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {models.map((model) => {
                      const isSelected = selectedModel === model.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelect(model.id);
                            onOpenChange(false);
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ease-out active:scale-[0.98] touch-manipulation min-h-12 select-none",
                            isSelected
                              ? "bg-muted font-medium text-foreground"
                              : "text-foreground/90 hover:bg-muted/50 active:bg-muted/70",
                          )}
                        >
                          <ModelSelectorLogo
                            provider={provider}
                            className="size-4 shrink-0 opacity-85"
                          />
                          <span className="flex-1 min-w-0 truncate text-sm leading-normal">
                            {model.displayName}
                          </span>
                          {isSelected ? (
                            <CheckIcon className="size-4.5 shrink-0 text-primary" />
                          ) : (
                            <span className="size-4.5 shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
