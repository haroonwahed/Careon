import { useEffect, useState } from "react";
import { Filter, RotateCcw, X } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { cn } from "../ui/utils";

/**
 * Advanced filter drawer for CareOn work queues.
 *
 * Supports saved views, include/exclude filter values, and active filter chips.
 * All filter application is handled by the parent via `onApply` — this component
 * is presentation-only and does not own filter state.
 *
 * Governance rule: Do not add filter controls that have no corresponding backend parameter.
 */

export type CareFilterTone = "critical" | "warning" | "neutral";

export interface CareFilterOption {
  value: string;
  label: string;
  count?: number;
  tone?: CareFilterTone;
}

export interface CareFilterGroup {
  id: string;
  label: string;
  type: "single" | "multi";
  options: CareFilterOption[];
}

export interface CareFilterValues {
  [groupId: string]: string | string[];
}

export interface CareSavedView {
  id: string;
  label: string;
  filters: CareFilterValues;
  isDefault?: boolean;
}

export interface CareFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterGroups: CareFilterGroup[];
  values: CareFilterValues;
  onApply: (values: CareFilterValues) => void;
  onReset: () => void;
  savedViews?: CareSavedView[];
  onSavedViewSelect?: (view: CareSavedView) => void;
  onSavedViewSave?: (label: string, filters: CareFilterValues) => void;
  title?: string;
  activeFilterCount?: number;
}

function CareFilterChip({
  label,
  tone,
  selected,
  onClick,
}: {
  label: string;
  tone?: CareFilterTone;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-[12px] font-medium transition-colors",
        selected
          ? tone === "critical"
            ? "border-care-urgent-border bg-care-urgent-bg text-care-urgent-text"
            : tone === "warning"
              ? "border-care-warning-border bg-care-warning-bg text-care-warning-text"
              : "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
      )}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

export function CareFilterDrawer({
  open,
  onOpenChange,
  filterGroups,
  values,
  onApply,
  onReset,
  savedViews,
  onSavedViewSelect,
  title = "Geavanceerde filters",
  activeFilterCount,
}: CareFilterDrawerProps) {
  const [localValues, setLocalValues] = useState<CareFilterValues>(values);

  useEffect(() => {
    if (open) {
      setLocalValues(values);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (groupId: string, value: string, type: CareFilterGroup["type"]) => {
    setLocalValues((prev) => {
      if (type === "single") {
        return { ...prev, [groupId]: prev[groupId] === value ? "" : value };
      }
      const current = (prev[groupId] as string[] | undefined) ?? [];
      return {
        ...prev,
        [groupId]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const isSelected = (groupId: string, value: string): boolean => {
    const current = localValues[groupId];
    if (Array.isArray(current)) {
      return current.includes(value);
    }
    return current === value;
  };

  const handleApply = () => {
    onApply(localValues);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalValues({});
    onReset();
  };

  const localActiveCount = Object.values(localValues).filter((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v),
  ).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-sm"
        style={{ zIndex: "var(--care-z-overlay)" }}
        aria-describedby={undefined}
      >
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border/60 px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-[14px]">
            <Filter size={15} aria-hidden />
            {title}
            {localActiveCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {localActiveCount}
              </span>
            )}
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => onOpenChange(false)}
            aria-label="Sluit filters"
          >
            <X size={15} />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Saved views */}
          {savedViews && savedViews.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 care-text-eyebrow text-muted-foreground/70">
                Opgeslagen weergaven
              </p>
              <div className="flex flex-wrap gap-2">
                {savedViews.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => {
                      setLocalValues(view.filters);
                      onSavedViewSelect?.(view);
                    }}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full border px-3 text-[12px] font-medium transition-colors",
                      view.isDefault
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {view.label}
                    {view.isDefault && <span className="ml-1.5 text-[10px] opacity-60">standaard</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filter groups */}
          <div className="space-y-5">
            {filterGroups.map((group) => (
              <div key={group.id}>
                <p className="mb-2 text-[12px] font-semibold text-foreground">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => (
                    <CareFilterChip
                      key={option.value}
                      label={option.count !== undefined ? `${option.label} (${option.count})` : option.label}
                      tone={option.tone}
                      selected={isSelected(group.id, option.value)}
                      onClick={() => handleToggle(group.id, option.value, group.type)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-[12px] text-muted-foreground"
            onClick={handleReset}
          >
            <RotateCcw size={12} aria-hidden />
            Wis filters
          </Button>
          <Button size="sm" className="h-8 rounded-full px-4 text-[12px] font-semibold" onClick={handleApply}>
            Toepassen
            {localActiveCount > 0 && (
              <span className="ml-1 opacity-70">({localActiveCount})</span>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Trigger button for the CareFilterDrawer — renders the filter button with active count chip.
 */
export function CareFilterDrawerTrigger({
  onClick,
  activeCount = 0,
  className,
}: {
  onClick: () => void;
  activeCount?: number;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-8 gap-2 rounded-full border-border/60 bg-background/70 px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground",
        className,
      )}
      aria-label={activeCount > 0 ? `Filters (${activeCount} actief)` : "Filters"}
    >
      <Filter size={13} aria-hidden />
      Filters
      {activeCount > 0 && (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );
}
