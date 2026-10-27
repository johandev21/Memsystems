import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, FileText, Globe, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import {
  generationSourceIconClass,
  generationSourceOptionClass,
} from "./option-row";
import { cn } from "@/shared/utils/cn";
import { SourceFavicon } from "@/features/sources";

const CHECKED_SOURCE_CHECKBOX_CLASS =
  "border-primary-foreground/40 data-checked:border-primary-foreground data-checked:bg-primary-foreground data-checked:text-primary dark:border-primary-foreground/60 dark:data-checked:border-primary-foreground dark:data-checked:bg-primary-foreground dark:data-checked:text-primary";

export type GenerationSource = { id: string; title: string; kind: string; url?: string | null };

interface GenerationSourcePopoverProps {
  sources: GenerationSource[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyMessage: string;
}

export function GenerationSourcePopover({
  sources,
  selectedIds,
  onChange,
  emptyMessage,
}: GenerationSourcePopoverProps) {
  const { t } = useTranslation("generation");
  const [search, setSearch] = useState("");
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredSources = sources.filter((source) =>
    source.title.toLowerCase().includes(search.toLowerCase()),
  );
  const allFilteredSourcesSelected =
    filteredSources.length > 0 &&
    filteredSources.every((source) => selectedIdSet.has(source.id));

  const toggleAllSources = () => {
    if (allFilteredSourcesSelected) {
      const filteredIds = new Set(filteredSources.map((source) => source.id));
      onChange(selectedIds.filter((id) => !filteredIds.has(id)));
      return;
    }
    onChange(Array.from(new Set([...selectedIds, ...filteredSources.map((source) => source.id)])));
  };

  const toggleSource = (id: string) => {
    onChange(
      selectedIdSet.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id],
    );
  };

  const isMobile = useMediaQuery("(max-width: 639px)");
  const [mobileOpen, setMobileOpen] = useState(false);

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className="h-11 sm:h-9 w-full justify-between gap-2 rounded-2xl border border-surface-border-subtle bg-surface-2 px-3.5 text-sm font-medium text-text-tertiary hover:bg-surface-3 hover:text-text-secondary active:scale-[0.99] touch-manipulation cursor-pointer"
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        <BookOpen className="size-4 shrink-0 text-primary" />
        <span className="truncate">
          {selectedIds.length === 0
            ? t("knowledge.noneSelected")
            : t("knowledge.selected", { count: selectedIds.length })}
        </span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-text-faint" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerTrigger render={triggerButton} />
        <DrawerContent className="max-h-[85dvh] p-4 pb-safe-lg overflow-y-auto">
          <DrawerHeader className="px-0 pt-0 pb-3 text-left">
            <DrawerTitle className="text-base font-semibold text-foreground">
              {t("fields.knowledgeSources", "Knowledge Sources")}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              {t("knowledge.selectedCount", { count: selectedIds.length })}
            </DrawerDescription>
          </DrawerHeader>

          <GenerationSourceSearchHeader
            search={search}
            onSearchChange={setSearch}
            onToggleAll={toggleAllSources}
            allFilteredSelected={allFilteredSourcesSelected}
            hasFilteredSources={filteredSources.length > 0}
            isMobile
          />

          <GenerationSourceOptionList
            sources={sources}
            filteredSources={filteredSources}
            selectedIdSet={selectedIdSet}
            onToggleSource={toggleSource}
            emptyMessage={emptyMessage}
            isMobile
          />

          <Button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="mt-3 h-12 w-full font-semibold rounded-xl active:scale-[0.98] touch-manipulation cursor-pointer"
          >
            {t("actions.done", "Done")}
          </Button>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover>
      <PopoverTrigger render={triggerButton} />
      <PopoverContent
        align="start"
        className="w-80 overflow-hidden rounded-2xl border border-surface-border bg-surface-1 p-0 shadow-xl"
      >
        <GenerationSourceSearchHeader
          search={search}
          onSearchChange={setSearch}
          onToggleAll={toggleAllSources}
          allFilteredSelected={allFilteredSourcesSelected}
          hasFilteredSources={filteredSources.length > 0}
        />
        <GenerationSourceOptionList
          sources={sources}
          filteredSources={filteredSources}
          selectedIdSet={selectedIdSet}
          onToggleSource={toggleSource}
          emptyMessage={emptyMessage}
        />
        <div className="border-t border-surface-border-subtle bg-surface-2 px-3.5 py-2 text-xs text-text-faint">
          {t("knowledge.selectedCount", { count: selectedIds.length })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface GenerationSourceSearchHeaderProps {
  search: string;
  onSearchChange: (search: string) => void;
  onToggleAll: () => void;
  allFilteredSelected: boolean;
  hasFilteredSources: boolean;
  isMobile?: boolean;
}

function GenerationSourceSearchHeader({
  search,
  onSearchChange,
  onToggleAll,
  allFilteredSelected,
  hasFilteredSources,
  isMobile,
}: GenerationSourceSearchHeaderProps) {
  const { t } = useTranslation("generation");

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 bg-surface-2",
        isMobile ? "rounded-xl px-3.5 py-2 mb-2" : "px-3.5 py-2.5",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Search className="size-4 shrink-0 text-text-faint" />
        <input
          type="text"
          placeholder={t("knowledge.searchPlaceholder")}
          aria-label={t("knowledge.searchAriaLabel")}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className={cn(
            "w-full bg-transparent text-sm outline-none placeholder:text-text-faint",
            isMobile && "h-9",
          )}
        />
      </div>
      <button
        type="button"
        onClick={onToggleAll}
        disabled={!hasFilteredSources}
        className={cn(
          "flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-text-faint",
          isMobile
            ? "rounded-lg px-2.5 py-1.5 hover:text-text-secondary active:scale-95 touch-manipulation"
            : "ml-2 rounded-md px-2 py-1 transition-colors hover:bg-surface-3 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {t("knowledge.selectAll")}
        <Checkbox
          checked={allFilteredSelected}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none"
        />
      </button>
    </div>
  );
}

interface GenerationSourceOptionListProps {
  sources: GenerationSource[];
  filteredSources: GenerationSource[];
  selectedIdSet: Set<string>;
  onToggleSource: (id: string) => void;
  emptyMessage: string;
  isMobile?: boolean;
}

function GenerationSourceOptionList({
  sources,
  filteredSources,
  selectedIdSet,
  onToggleSource,
  emptyMessage,
  isMobile,
}: GenerationSourceOptionListProps) {
  if (sources.length === 0) {
    return (
      <div className={cn("text-center text-xs text-text-faint", isMobile ? "py-8" : "p-4")}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-y-auto",
        isMobile
          ? "max-h-[50dvh] space-y-1.5 overscroll-contain py-1"
          : "max-h-55 space-y-1 p-2",
      )}
    >
      {filteredSources.map((source) => (
        <GenerationSourceOptionRow
          key={source.id}
          source={source}
          checked={selectedIdSet.has(source.id)}
          onToggle={onToggleSource}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}

interface GenerationSourceOptionRowProps {
  source: GenerationSource;
  checked: boolean;
  onToggle: (id: string) => void;
  isMobile?: boolean;
}

function GenerationSourceOptionRow({
  source,
  checked,
  onToggle,
  isMobile,
}: GenerationSourceOptionRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(source.id)}
      className={cn(
        generationSourceOptionClass(checked),
        isMobile && "min-h-12 py-3 px-3.5 active:scale-[0.99] touch-manipulation",
      )}
    >
      <span className={cn("flex min-w-0 items-center truncate pr-2", isMobile ? "gap-2.5" : "gap-2")}>
        {source.kind === "web" || source.kind === "url" ? (
          <SourceFavicon
            url={source.url}
            title={source.title}
            className={cn(generationSourceIconClass(checked), "object-contain rounded-xs")}
            fallback={<Globe className={generationSourceIconClass(checked)} />}
          />
        ) : source.kind === "file" ? (
          <FileText className={generationSourceIconClass(checked)} />
        ) : (
          <BookOpen className={generationSourceIconClass(checked)} />
        )}
        <span className={cn("truncate", isMobile && "text-sm")}>{source.title}</span>
      </span>
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(source.id)}
        className={checked ? CHECKED_SOURCE_CHECKBOX_CLASS : undefined}
      />
    </button>
  );
}
